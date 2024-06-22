/**
 * Calculates voting weight with constant weight per token
 * @param balance - Token balance of the voter
 * @returns The calculated voting weight (same as linear with coefficient 1)
 */
function affine(balance: number): number {
  return balance; // Each token contributes one vote
}

/**
 * Calculates voting weight proportionally to the token balance
 * @param balance - Token balance of the voter
 * @param coefficient - The proportionality coefficient (weight per token)
 * @returns The calculated voting weight
 */
function linear(balance: number, coefficient = 1): number {
  if (coefficient <= 0) throw new Error("Coefficient must be positive"); // Ensure valid coefficient
  return coefficient * balance; // Voting power scales linearly with balance
}

/**
 * Calculates voting weight using a geometric series with a decreasing factor
 * @param balance - Token balance of the voter
 * @param factor - The factor by which the weight decreases with each additional token (default: 0.99998)
 * @returns The calculated voting weight
 * @throws Error if the factor is not positive
 */
function geometric(balance: number, factor: number = 0.99998): number {
  if (factor <= 0) throw new Error("Factor must be positive"); // Ensure valid factor
  return (1 - Math.pow(factor, balance + 1)) / (1 - factor); // Sum of geometric series
}

/**
 * Calculates voting weight using an exponential decay function
 * @param balance - Token balance of the voter
 * @param maxWeight - The maximum achievable voting weight (default: 50000)
 * @param halfLife - The balance at which the voting weight is half of the maxWeight (default: 34657)
 * @param exponent - The base of the exponential function (default: 2)
 * @returns The calculated voting weight
 * @throws Error if maxWeight is not positive
 */
function exponential(
  balance: number,
  maxWeight: number = 50000,
  halfLife: number = 34657,
  exponent: number = 2
): number {
  if (maxWeight <= 0) throw new Error("Max weight must be positive"); // Ensure valid maxWeight
  return Math.max(
    0,
    maxWeight - maxWeight / Math.pow(exponent, balance / halfLife)
  ); // Exponential decay formula
}

/**
 * Calculates voting weight as the reciprocal of a power law function (balance ^ exponent)
 * @param balance - Token balance of the voter
 * @param exponent - Exponent of the power law function (default: 1.05)
 * @returns The calculated voting weight
 * @throws Error if the exponent is not positive
 */
function nthRoot(balance: number, exponent: number = 1.05): number {
  if (exponent <= 0) throw new Error("Exponent must be positive"); // Ensure valid exponent
  return Math.pow(balance, 1 / exponent); // Reciprocal of power law
}

/**
 * Calculates voting weight using a power law function (1 / balance ^ -exponent)
 * @param balance - Token balance of the voter
 * @param exponent - Exponent of the power law function (default: 0.95)
 * @returns The calculated voting weight
 * @throws Error if the exponent is not positive
 */
function powerLaw(balance: number, exponent: number = 0.95): number {
  if (exponent <= 0) throw new Error("Exponent must be positive"); // Ensure valid exponent
  return 1 / Math.pow(balance, -exponent); // Power law formula
}

/**
 * Calculates voting weight using a step function with specified thresholds and weights
 * @param balance - Token balance of the voter
 * @param steps - An array of token balance thresholds (default: [10, 100, 1000, 10000, 100000, 1000000])
 * @param weights - An array of corresponding voting weights for each step (default: [1, 0.95, 0.82, 0.7, 0.42, 0.12])
 * @returns The calculated voting weight
 */
function step(
  balance: number,
  steps: number[] = [10, 100, 1000, 10000, 100000, 1000000],
  weights: number[] = [1, 0.95, 0.82, 0.7, 0.42, 0.12]
): number {
  return steps.reduce((totalPower, step, i) => {
    // Accumulate voting power over steps
    const prevStep = i === 0 ? 0 : steps[i - 1];
    const tokensInStep = Math.max(
      0,
      Math.min(balance - prevStep, step - prevStep)
    ); // Tokens within current step
    return totalPower + tokensInStep * weights[i]; // Add weighted voting power for this step
  }, 0);
}

/**
 * Calculates voting weight using point-to-point linear interpolation between specified points
 * @param balance - Token balance of the voter
 * @param points - An array of [threshold, weight] pairs defining the voting power curve (default: specific points)
 * @returns The calculated voting weight
 */
function pointToPoint(
  balance: number,
  points: [number, number][] = [
    [10, 1],
    [100, 0.95],
    [1000, 0.82],
    [10000, 0.7],
    [100000, 0.42],
    [1000000, 0.12],
  ]
): number {
  points.sort((a, b) => a[0] - b[0]); // ensure points are sorted by threshold
  const intervalIndex = points.findIndex(([threshold]) => balance < threshold); // Find interval
  if (intervalIndex === -1) return 0; // above highest threshold
  if (intervalIndex === 0) return points[0][1]; // below lowest threshold
  const [x1, y1] = points[intervalIndex - 1]; // Interpolation coordinates
  const [x2, y2] = points[intervalIndex];
  return y1 + ((y2 - y1) / (x2 - x1)) * (balance - x1); // Linear interpolation
}

// (rest of the code with cubicSplineVotingPower and sigmoidVotingPower remains the same, with similar commenting style)
/**
 * Calculates voting weight using cubic spline interpolation for a smoother curve
 * @param balance - Token balance of the voter
 * @param points - An array of [threshold, weight] pairs defining the voting power curve
 * @returns The calculated voting weight
 */
function cubicSpline(
  balance: number,
  points: [number, number][] = [
    [10, 1],
    [100, 0.95],
    [1000, 0.82],
    [10000, 0.7],
    [100000, 0.42],
    [1000000, 0.12],
  ]
): number {
  points.sort((a, b) => a[0] - b[0]);

  const tangents = points.map((_, i) => {
    if (i === 0)
      return (points[1][1] - points[0][1]) / (points[1][0] - points[0][0]);
    if (i === points.length - 1)
      return (
        (points[i][1] - points[i - 1][1]) / (points[i][0] - points[i - 1][0])
      );
    return (
      (points[i + 1][1] - points[i - 1][1]) /
      (points[i + 1][0] - points[i - 1][0])
    );
  });

  let totalVotingPower = 0;
  let remainingBalance = balance;

  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const m1 = tangents[i];
    const m2 = tangents[i + 1];

    const tokensInInterval = Math.max(0, Math.min(remainingBalance, x2 - x1));

    if (tokensInInterval > 0) {
      const t1 = (x1 - (i === 0 ? 0 : points[i - 1][0])) / (x2 - x1);
      const votingPower1 = y1 + ((x2 - x1) * (t1 * m1 + (1 - t1) * m2)) / 2;
      const votingPower2 = y2;
      const intervalVotingPower =
        ((votingPower1 + votingPower2) / 2) * tokensInInterval;
      totalVotingPower += intervalVotingPower;
      remainingBalance -= tokensInInterval;
    }

    if (remainingBalance === 0) {
      break;
    }
  }

  return totalVotingPower;
}

/**
 * Calculates voting weight using cubic spline interpolation based on pre-defined inflection points and a maximum weight
 * @param balance - Token balance of the voter
 * @param inflectionPoint - Token balance at which the voting power curve inflects
 * @param maxWeight - The maximum voting weight achievable at the inflection point
 * @returns The calculated voting weight
 * @throws Error if inflectionPoint or maxWeight are not positive
 */
function sigmoid(
  balance: number,
  inflectionPoint: number = 10000,
  maxWeight: number = 50000
): number {
  if (inflectionPoint <= 0 || maxWeight <= 0)
    throw new Error("Inflection point and max weight must be positive");
  const points: [number, number][] = [
    [0, 1],
    [inflectionPoint / 3, maxWeight / 10],
    [(2 * inflectionPoint) / 3, maxWeight / 4],
    [inflectionPoint, maxWeight / 2],
    [(4 * inflectionPoint) / 3, (3 * maxWeight) / 4],
    [(5 * inflectionPoint) / 3, (9 * maxWeight) / 10],
    [2 * inflectionPoint, maxWeight],
  ];
  return cubicSpline(balance, points);
}

const votingPowerSchemes: Record<string, (balance: number, ...args: any[]) => number> = {
  affine,
  linear,
  geometric,
  exponential,
  nthRoot,
  powerLaw,
  step,
  pointToPoint,
  cubicSpline,
  sigmoid,
};

function getVotingPowerScheme(name: string) {
  if (!votingPowerSchemes[name]) {
    throw new Error(`Voting power function "${name}" not found`);
  }
  return votingPowerSchemes[name];
}

function getVotingPower(name: string, balance: number) {
  return getVotingPowerScheme(name)?.(balance);
}

export { getVotingPowerScheme, getVotingPower };
