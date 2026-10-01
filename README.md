# Analog Front-end Designer

`analog-front-end-designer` is a dependency-free Node.js toolkit for traceable sensor-to-ADC engineering. It covers divider loading, amplifier gain and level shifting, bridge and instrumentation stages, ADC resolution and acquisition, anti-alias filtering, noise and accuracy budgets, protection, headroom, calibration, and production-tolerance yield.

It is intended for architecture and design review. Precision performance still requires validated component models, PCB leakage and thermoelectric analysis, grounding/shielding review, SPICE simulation, calibrated measurements, and environmental testing.

## Capabilities

- Calculate loaded dividers, Thevenin resistance, current, and resistor/load power.
- Design non-inverting and inverting stages around an arbitrary reference.
- Map sensor spans into ADC spans with gain and offset.
- Check instrumentation-amplifier gain and output-rail headroom.
- Convert bridge excitation, sensitivity, offset, and applied load into output voltage.
- Calculate ADC LSB, quantization noise, effective bits, SNR, and output code.
- Verify ADC sampling-capacitor acquisition settling to half an LSB.
- Evaluate RC cutoff, magnitude, attenuation, phase, and alias folding.
- Combine op-amp voltage/current density with source Johnson noise.
- Build output-referred RMS noise and full-scale SNR budgets.
- Combine accuracy sources expressed in volts, microvolts, or ppm of full scale.
- Size input clamp current, resistor pulse/average power, and leakage error.
- Check input common-mode and output swing ranges.
- Fit linear calibrations and report residual error.
- Run deterministic Monte Carlo analysis across gain, offset, and reference tolerances.
- Generate concise Markdown review reports.

## Requirements

- Node.js 18 or newer

## Quick start

```bash
npm install
npm test
node src/cli.js bridge examples/bridge.json
node src/cli.js adc 16 3.3 --noise 50 --input 1.65
node src/cli.js noise examples/noise.json --full-scale 3.3
node src/cli.js error examples/errors.json 3.3
node src/cli.js monte-carlo examples/chain.json --iterations 1000 --seed 42
```

## CLI

```text
analog-front-end-designer divider inputV topOhm bottomOhm --load ohm
analog-front-end-designer amplifier input.json
analog-front-end-designer map sensorMinV sensorMaxV outputMinV outputMaxV
analog-front-end-designer instrumentation input.json
analog-front-end-designer bridge input.json
analog-front-end-designer adc bits referenceV --noise rmsMicrovolts --input voltageV
analog-front-end-designer settling sourceOhm sampleCapPf acquisitionUs bits --step V --reference V
analog-front-end-designer filter resistanceOhm capacitanceF frequencies.json
analog-front-end-designer alias signalHz sampleHz
analog-front-end-designer opamp-noise input.json
analog-front-end-designer noise contributors.json --full-scale V
analog-front-end-designer error contributors.json fullScaleV --coverage factor
analog-front-end-designer protection input.json
analog-front-end-designer headroom input.json
analog-front-end-designer calibrate points.json
analog-front-end-designer monte-carlo input.json --iterations N --seed N
analog-front-end-designer report bundle.json --output report.md
```

## Library API

```js
import {
  loadedDivider, amplifierStage, sensorMapping, instrumentationAmplifier,
  bridgeMeasurement, adcPerformance, adcSettling, rcLowPass,
  aliasFrequency, opAmpNoise, noiseBudget, errorBudget,
  inputProtection, headroomCheck, linearCalibration,
  monteCarloChain, reportMarkdown
} from '@opencircuitlabs/analog-front-end-designer';

const mapping = sensorMapping(0.5, 4.5, 0.1, 3.1);
const adc = adcPerformance(16, 3.3, { inputNoiseRmsMicrovolts: 50 });
console.log(mapping.gain, adc.effectiveNumberOfBits);
```

## Engineering assumptions

- Resistors and capacitors are ideal at the evaluated frequencies unless their parasitics are explicitly included elsewhere.
- Amplifier equations assume closed-loop stability and adequate gain-bandwidth, slew rate, input bias behavior, common-mode range, and output drive.
- Noise densities are treated as white across the declared equivalent noise bandwidth; 1/f noise and correlated sources require separate integration.
- ADC settling uses a first-order source-resistance/sample-capacitor model; switch resistance, charge kickback, external capacitance, and multiplexing may dominate.
- Accuracy RSS assumes independent contributors with the stated distributions. Worst-case results sum magnitudes.
- Protection calculations do not replace surge, ESD, insulation, creepage, clearance, or safety-standard testing.

## Development

```bash
npm test
npm run check
```

CI runs all tests on Node.js 18, 20, and 22.

## License

MIT © OpenCircuitLabs contributors. See [LICENSE](LICENSE).
