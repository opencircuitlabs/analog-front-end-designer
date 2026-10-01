import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adcPerformance,adcSettling,aliasFrequency,amplifierStage,bridgeMeasurement,
  errorBudget,headroomCheck,inputProtection,instrumentationAmplifier,
  linearCalibration,loadedDivider,monteCarloChain,noiseBudget,opAmpNoise,
  rcLowPass,reportMarkdown,sensorMapping
} from '../src/index.js';

test('calculates an unloaded divider including power and Thevenin resistance',()=>{
  const result=loadedDivider(10,10000,10000);
  assert.equal(result.outputVoltageV,5);
  assert.equal(result.dividerCurrentA,.0005);
  assert.equal(result.theveninResistanceOhm,5000);
  assert.equal(result.topPowerW,.0025);
  assert.equal(result.bottomPowerW,.0025);
});

test('accounts for divider load impedance',()=>{
  const result=loadedDivider(10,10000,10000,10000);
  assert.equal(result.effectiveBottomOhm,5000);
  assert.equal(result.outputVoltageV,3.333333);
  assert.equal(result.theveninResistanceOhm,3333.333333);
  assert.ok(result.loadPowerW>0);
});

test('validates divider resistance and input voltage',()=>{
  assert.throws(()=>loadedDivider(NaN,1,1),/finite input/);
  assert.throws(()=>loadedDivider(1,0,1),/positive top/);
});

test('calculates non-inverting gain around a reference',()=>{
  const result=amplifierStage({topology:'non-inverting',inputVoltageV:.3,referenceVoltageV:.1,feedbackOhm:9000,gainOhm:1000});
  assert.equal(result.gain,10);
  assert.equal(result.outputVoltageV,2.1);
  assert.equal(result.noiseGain,10);
});

test('calculates inverting gain and reference translation',()=>{
  const result=amplifierStage({topology:'inverting',inputVoltageV:.2,referenceVoltageV:1.65,feedbackOhm:10000,gainOhm:1000});
  assert.equal(result.gain,-10);
  assert.equal(result.noiseGain,11);
  assert.equal(result.outputVoltageV,16.15);
  assert.throws(()=>amplifierStage({topology:'buffer',feedbackOhm:1,gainOhm:1}),/supported amplifier/);
});

test('maps a sensor span into an ADC span',()=>{
  const result=sensorMapping(.5,4.5,.1,3.1);
  assert.equal(result.gain,.75);
  assert.equal(result.offsetVoltageV,-.275);
  assert.equal(result.inputSpanV,4);
  assert.equal(result.outputSpanV,3);
});

test('rejects reversed sensor ranges',()=>{
  assert.throws(()=>sensorMapping(1,0,0,1),/ordered finite/);
});

test('checks instrumentation amplifier gain and output headroom',()=>{
  const result=instrumentationAmplifier({differentialInputV:.01,gainResistorOhm:1000,gainFactorOhm:50000,baseGain:1,referenceVoltageV:1.65,negativeSupplyV:0,positiveSupplyV:3.3,outputHeadroomV:.1});
  assert.equal(result.gain,51);
  assert.equal(result.outputVoltageV,2.16);
  assert.equal(result.pass,true);
  assert.equal(result.outputMarginHighV,1.04);
});

test('flags instrumentation output saturation',()=>{
  const result=instrumentationAmplifier({differentialInputV:.1,gainResistorOhm:1000,gainFactorOhm:50000,positiveSupplyV:3.3,negativeSupplyV:0,outputHeadroomV:.1});
  assert.equal(result.pass,false);
});

test('calculates bridge signal, offset, gain, and reference',()=>{
  const result=bridgeMeasurement({excitationVoltageV:5,sensitivityMvPerV:2,fullScaleUnits:100,appliedUnits:50,offsetMicrovolts:25,gain:100,referenceVoltageV:1.65});
  assert.equal(result.fractionOfFullScale,.5);
  assert.equal(result.bridgeDifferentialV,.005025);
  assert.equal(result.outputVoltageV,2.1525);
});

test('calculates ADC LSB, quantization noise, ENOB, and code',()=>{
  const result=adcPerformance(12,4.096,{inputVoltageV:2.048});
  assert.equal(result.levels,4096);
  assert.equal(result.lsbMicrovolts,1000);
  assert.equal(result.quantizationNoiseRmsMicrovolts,288.675135);
  assert.equal(result.effectiveNumberOfBits,12);
  assert.equal(result.code,2048);
});

test('reduces ADC ENOB when input noise is added',()=>{
  const result=adcPerformance(16,3.3,{inputNoiseRmsMicrovolts:200});
  assert.ok(result.effectiveNumberOfBits<16);
  assert.throws(()=>adcPerformance(0,3.3),/positive integer ADC/);
});

test('checks ADC acquisition settling against half an LSB',()=>{
  const result=adcSettling(1000,20,.2,12,4.096,4.096);
  assert.equal(result.timeConstantNanoseconds,20);
  assert.equal(result.halfLsbMicrovolts,500);
  assert.equal(result.requiredAcquisitionMicroseconds,.180218);
  assert.equal(result.pass,true);
});

test('flags insufficient ADC acquisition time',()=>{
  assert.equal(adcSettling(10000,20,.1,16,4.096,4.096).pass,false);
});

test('evaluates RC cutoff, attenuation, and phase',()=>{
  const result=rcLowPass(1000,1e-6,[0,159.154943,1000]);
  assert.equal(result.cutoffFrequencyHz,159.154943);
  assert.equal(result.rows[0].magnitude,1);
  assert.ok(Math.abs(result.rows[1].attenuationDb+3.0103)<.00001);
  assert.ok(result.rows[2].phaseDegrees<-80);
});

test('folds out-of-band tones into the Nyquist zone',()=>{
  assert.deepEqual(aliasFrequency(900,1000),{signalFrequencyHz:900,sampleFrequencyHz:1000,nyquistFrequencyHz:500,aliasFrequencyHz:100,aliases:true});
  assert.equal(aliasFrequency(100,1000).aliases,false);
});

test('combines op-amp voltage, current, and source Johnson noise',()=>{
  const result=opAmpNoise({voltageNoiseNvRootHz:10,currentNoisePaRootHz:1,sourceResistanceOhm:10000,bandwidthHz:10000,temperatureK:300,noiseGain:10});
  assert.equal(result.inputVoltageNoiseRmsMicrovolts,1);
  assert.equal(result.inputCurrentNoiseRmsMicrovolts,1);
  assert.ok(result.sourceJohnsonNoiseRmsMicrovolts>1.28);
  assert.ok(result.totalOutputNoiseRmsMicrovolts>19);
});

test('builds an output-referred RMS noise budget and SNR',()=>{
  const result=noiseBudget([{name:'sensor',inputNoiseRmsMicrovolts:5,gainToOutput:10},{name:'adc',inputNoiseRmsMicrovolts:30,gainToOutput:1}],3.3);
  assert.equal(result.totalOutputNoiseRmsMicrovolts,58.309519);
  assert.ok(result.fullScaleSnrDb>90);
});

test('combines mixed-unit error sources by RSS and worst case',()=>{
  const result=errorBudget([{name:'offset',microvolts:100,distribution:'rectangular'},{name:'gain',ppmOfFullScale:100,distribution:'normal'}],5,2);
  assert.equal(result.rows[1].volts,.0005);
  assert.equal(result.combinedStandardMicrovolts,503.322296);
  assert.equal(result.expandedMicrovolts,1006.644591);
  assert.equal(result.worstCaseMicrovolts,600);
});

test('sizes protection resistance, clamp current, pulse power, and leakage error',()=>{
  const result=inputProtection({maximumInputV:24,clampVoltageV:5,seriesResistanceOhm:1000,resistorPowerRatingW:.1,maximumClampCurrentA:.02,inputLeakageNanoamp:100,pulseDurationSeconds:.1,repetitionPeriodSeconds:1});
  assert.equal(result.clampCurrentA,.019);
  assert.equal(result.peakResistorPowerW,.361);
  assert.equal(result.averageResistorPowerW,.0361);
  assert.equal(result.leakageErrorMicrovolts,100);
  assert.equal(result.pass,true);
});

test('flags protection overstress and validates clamp ordering',()=>{
  assert.equal(inputProtection({maximumInputV:24,clampVoltageV:5,seriesResistanceOhm:100,resistorPowerRatingW:.1}).pass,false);
  assert.throws(()=>inputProtection({maximumInputV:5,clampVoltageV:5,seriesResistanceOhm:1,resistorPowerRatingW:1}),/must exceed/);
});

test('checks input common-mode and output swing headroom',()=>{
  const passing=headroomCheck({negativeSupplyV:0,positiveSupplyV:5,inputCommonModeHeadroomV:.2,outputHeadroomFromRailV:.1,inputMinimumV:.5,inputMaximumV:4,outputMinimumV:.2,outputMaximumV:4.8});
  assert.equal(passing.pass,true);
  const failing=headroomCheck({negativeSupplyV:0,positiveSupplyV:5,inputCommonModeHeadroomV:.5,outputHeadroomFromRailV:.5,inputMinimumV:.1,inputMaximumV:4,outputMinimumV:.2,outputMaximumV:4.8});
  assert.equal(failing.pass,false);
});

test('fits a linear calibration and reports residuals',()=>{
  const result=linearCalibration([{raw:0,reference:1},{raw:1,reference:3},{raw:2,reference:5}]);
  assert.equal(result.slope,2);
  assert.equal(result.intercept,1);
  assert.equal(result.rmsResidual,0);
  assert.throws(()=>linearCalibration([{raw:1,reference:1},{raw:1,reference:2}]),/must vary/);
});

test('runs deterministic analog-chain tolerance analysis',()=>{
  const input={sensorInputV:.2,nominalGain:10,gainTolerancePercent:.5,nominalOffsetV:.1,offsetToleranceMicrovolts:500,referenceVoltageV:3.3,referenceTolerancePercent:.1},first=monteCarloChain(input,{iterations:100,seed:11}),second=monteCarloChain(input,{iterations:100,seed:11});
  assert.deepEqual(first,second);
  assert.ok(first.p05OutputV<=first.p50OutputV);
  assert.ok(first.p50OutputV<=first.p95OutputV);
  assert.throws(()=>monteCarloChain(input,{iterations:0}),/positive integer/);
});

test('renders a compact analog design report',()=>{
  const mapping=sensorMapping(.5,4.5,.1,3.1),adc=adcPerformance(12,4.096),noise=noiseBudget([{inputNoiseRmsMicrovolts:10,gainToOutput:1}],4.096),error=errorBudget([{microvolts:100}],4.096);
  const report=reportMarkdown({mapping,adc,noise,error});
  assert.match(report,/# Analog front-end design/);
  assert.match(report,/Sensor gain: 0.75/);
  assert.match(report,/ADC: 12 bit/);
  assert.match(report,/Output noise: 10 uV RMS/);
  assert.match(report,/Expanded error: 200 uV/);
});
