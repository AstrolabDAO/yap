/**
 * Scales down a value to a manageable range using a precision parameter.
 * @param value - The number or bigint to scale down.
 * @param precision - The number of significant digits to retain.
 * @returns A tuple containing the scaled down value and the scale factor.
 */
function scaleDown(
  value: number | bigint,
  precision: number = 5
): [number, number] {
  if (typeof value === "bigint") {
    const strValue = value.toString();
    const orderOfMagnitude = strValue.length - 1;
    const significantDigits = Math.min(precision, strValue.length);
    const scaleFactor = 10n ** BigInt(orderOfMagnitude - significantDigits + 1);
    const scaledValue = value / scaleFactor;
    return [Number(scaledValue), Number(scaleFactor)];
  } else {
    const orderOfMagnitude = Math.floor(Math.log10(value));
    const scaleFactor = 10 ** (orderOfMagnitude - precision + 1);
    return [value / scaleFactor, scaleFactor];
  }
}

/**
 * Scales up a value using the provided scale factor.
 * @param value - The scaled down value.
 * @param scaleFactor - The scale factor used to scale the value down.
 * @returns The original value after scaling up.
 */
function scaleUp(value: number, scaleFactor: number): number {
  return value * scaleFactor;
}

/**
 * Calculates a simple moving average (SMA) for a time series.
 * @param series - An array of numbers or bigints representing the time series data.
 * @param period - The length of the moving average window.
 * @param precision - The number of significant digits to retain when scaling down.
 * @returns The simple moving average for each point in the series.
 */
function simple(
  series: (number | bigint)[],
  period: number,
  precision: number = 5
): number[] {
  if (series.length < period) {
    throw new Error(
      "Series length must be greater than or equal to the period"
    );
  }

  const averages: number[] = [];
  let sum: number = 0;
  let scaleFactor: number = 1;

  for (let i = 0; i < period; i++) {
    const [scaledValue, factor] = scaleDown(series[i], precision);
    sum += scaledValue;
    if (i === 0) scaleFactor = factor;
  }

  averages.push(scaleUp(sum / period, scaleFactor));

  for (let i = period; i < series.length; i++) {
    const [scaledAddValue] = scaleDown(series[i], precision);
    const [scaledRemoveValue] = scaleDown(series[i - period], precision);

    sum += scaledAddValue - scaledRemoveValue;

    averages.push(scaleUp(sum / period, scaleFactor));
  }

  return averages;
}

/**
 * Calculates an exponential moving average (EMA) for a time series.
 * @param series - An array of numbers or bigints representing the time series data.
 * @param period - The length of the moving average window.
 * @param precision - The number of significant digits to retain when scaling down.
 * @returns The exponential moving average for each point in the series.
 */
function exponential(
  series: (number | bigint)[],
  period: number,
  precision: number = 5
): number[] {
  if (series.length < period) {
    throw new Error(
      "Series length must be greater than or equal to the period"
    );
  }

  const smoothingFactor = 2 / (period + 1);
  const ema: number[] = [];
  let scaleFactor: number = 1;

  const [firstScaledValue, firstFactor] = scaleDown(series[0], precision);
  ema.push(firstScaledValue);
  scaleFactor = firstFactor;

  for (let i = 1; i < series.length; i++) {
    const [scaledValue] = scaleDown(series[i], precision);
    ema.push(
      scaledValue * smoothingFactor + ema[i - 1] * (1 - smoothingFactor)
    );
  }

  return ema.map((value) => scaleUp(value, scaleFactor));
}

/**
 * Calculates a smoothed moving average (SMMA) for a time series.
 * @param series - An array of numbers or bigints representing the time series data.
 * @param period - The length of the moving average window.
 * @param precision - The number of significant digits to retain when scaling down.
 * @returns The smoothed moving average for each point in the series.
 */
function smoothed(
  series: (number | bigint)[],
  period: number,
  precision: number = 5
): number[] {
  if (series.length < period) {
    throw new Error(
      "Series length must be greater than or equal to the period"
    );
  }

  const sma = simple(series, period, precision);
  const smma: number[] = [sma[0]];

  for (let i = 1; i < sma.length; i++) {
    smma.push((smma[i - 1] * (period - 1) + sma[i]) / period);
  }

  return smma;
}

/**
 * Calculates a weighted moving average (WMA) for a time series.
 * @param series - An array of numbers or bigints representing the time series data.
 * @param weights - An array of weights for each data point in the period. Length should match period.
 * @param precision - The number of significant digits to retain when scaling down.
 * @returns The weighted moving average for each point in the series.
 */
function weighted(
  series: (number | bigint)[],
  weights: number[],
  precision: number = 5
): number[] {
  const period = weights.length;
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (series.length < period || Math.abs(weightSum - 1) > 1e-10) {
    throw new Error(
      "Series length must be >= period and weights must sum to 1"
    );
  }

  const wma: number[] = [];
  let scaleFactor: number = 1;

  for (let i = period - 1; i < series.length; i++) {
    let weightedSum: number = 0;
    for (let j = 0; j < period; j++) {
      const [scaledValue, factor] = scaleDown(
        series[i - period + 1 + j],
        precision
      );
      weightedSum += scaledValue * weights[j];
      if (j === 0) scaleFactor = factor;
    }
    wma.push(scaleUp(weightedSum, scaleFactor));
  }

  return wma;
}

/**
 * Calculates a linear regression trendline for a time series.
 * @param series - An array of numbers or bigints representing the time series data.
 * @param period - The length of the window for which the linear regression is calculated. If not provided, it defaults to the full length of the series.
 * @param precision - The number of significant digits to retain when scaling down.
 * @returns An array of numbers representing the predicted values based on the linear regression trendline.
 */
function linearRegression(
  series: (number | bigint)[],
  period?: number,
  precision: number = 5
): number[] {
  const n = period ?? series.length;
  const trendline: number[] = [];

  for (let i = n - 1; i < series.length; i++) {
    const xValues = Array.from({ length: n }, (_, j) => j + 1);
    const yValues = series
      .slice(i - n + 1, i + 1)
      .map((value) => scaleDown(value, precision)[0]);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((acc, x, j) => acc + x * yValues[j], 0);
    const sumXX = xValues.reduce((a, b) => a + b * b, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    trendline.push(slope * (n + 1) + intercept);
  }

  return trendline;
}

const averages: Record<string, (series: number[]|bigint[], ...args: any[]) => number[]> = {
  simple,
  exponential,
  smoothed,
  weighted,
  linearRegression,
};

function getMovingAverageFunction(name: string) {
  if (!averages[name]) {
    throw new Error(`Unknown average function: ${name}`);
  }
  return averages[name];
}

function getMovingAverage(
  series: number[] | bigint[],
  name: string,
  ...args: any[]
): number[] {
  return getMovingAverageFunction(name)?.(series, ...args);
}

export { getMovingAverage, getMovingAverageFunction };
