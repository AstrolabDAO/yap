<div align="center">
  <img style="border-radius=25px; max-height=250px;" height="400" src="./banner.png" />
  <p>
    <!-- <a href="https://t.me/yap_governance"><img alt="Yap" src="https://img.shields.io/badge/Yap--white?style=social&logo=telegram"> -->
    <a href="https://discord.gg/xEEHAY2v5t"><img alt="Discord Chat" src="https://img.shields.io/badge/Astrolab%20DAO--white?logo=discord&style=social"/></a>
    <a href="https://twitter.com/AstrolabDAO"><img alt="Twitter Follow" src="https://img.shields.io/twitter/follow/AstrolabDAO?label=@AstrolabDAO&style=social"></a>
    <!-- <a href="https://docs.astrolab.fi"><img alt="Astrolab Docs" src="https://img.shields.io/badge/astrolab_docs-F9C3B3" /></a> -->
    <a href="https://opensource.org/licenses/MIT"><img alt="License" src="https://img.shields.io/github/license/AstrolabDAO/yap?style=social" /></a>
  </p>
  <!-- <p>
    <strong>by <a href="https://astrolab.fi">Astrolab DAO</a> & friends</strong>
  </p> -->
</div>

Yap is a streamlined, performance-focused application designed to empower DAOs with comprehensive governance capabilities. It enables DAOs to swiftly define token eligibility for messaging, poposal drafting and vote casting, and even manage airdrop claims.

## Key Features

* **Unified Governance:** Yap consolidates essential DAO governance functions into a single platform, eliminating the need for multiple tools (eg. Snapshot+).
* **Real-time:** Vote and discuss proposals as they happen thanks to WebSockets.
* **Cross-chain Token Support:** Any token on any blockchain can be added integrated to eligibility criteria, fostering inclusion and participation rate.
* **Advanced Voting Mechanisms:** Yap offers a wide array of snapshot balance averaging and vote weighting schemes, many of which are not found anywhere else.
* **Airdrop Management:** Leveraging the same snapshot mechanisms used for voting, assess user contributions and distribute airdrops seamlessly.

## Voting Schemes

| Scheme        | Description                                                                                                         | Parameters                                                                                            | Example Usage                            |
|---------------|---------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|------------------------------------------|
| **Affine**    | Each token contributes one vote.                                                                                    | `balance` - Token balance of the voter.                                                               | `affine(1000)`                           |
| **Linear**    | Voting power scales linearly with balance using a proportionality coefficient.                                      | `balance` - Token balance of the voter.<br>`coefficient` - Proportionality coefficient (default: 1).  | `linear(1000, 2)`                        |
| **Geometric** | Voting weight decreases with each additional token, using a geometric series.                                       | `balance` - Token balance of the voter.<br>`factor` - Decreasing factor (default: 0.99998).           | `geometric(1000, 0.99998)`               |
| **Exponential** | Uses an exponential decay function, prioritizing more recent balances.                                            | `balance` - Token balance of the voter.<br>`maxWeight` - Max voting weight (default: 50000).<br>`halfLife` - Balance at half max weight (default: 34657).<br>`exponent` - Base of exponential function (default: 2). | `exponential(1000)`                      |
| **Nth Root**  | Voting weight calculated as the reciprocal of a power law function.                                                 | `balance` - Token balance of the voter.<br>`exponent` - Exponent of the power law function (default: 1.05). | `nthRoot(1000)`                          |
| **Power Law** | Uses a power law function for voting weight.                                                                        | `balance` - Token balance of the voter.<br>`exponent` - Exponent of the power law function (default: 0.95). | `powerLaw(1000)`                         |
| **Step**      | Voting weight calculated using a step function with specified thresholds and weights.                               | `balance` - Token balance of the voter.<br>`steps` - Array of balance thresholds.<br>`weights` - Corresponding voting weights. | `step(1000, [10, 100, 1000], [1, 0.95, 0.82])` |
| **Point-to-Point** | Linear interpolation between specified points to calculate voting weight.                                      | `balance` - Token balance of the voter.<br>`points` - Array of [threshold, weight] pairs.             | `pointToPoint(1000, [[10, 1], [100, 0.95]])` |
| **Cubic Spline** | Uses cubic spline interpolation for a smoother voting weight curve.                                              | `balance` - Token balance of the voter.<br>`points` - Array of [threshold, weight] pairs.             | `cubicSpline(1000, [[10, 1], [100, 0.95]])` |
| **Sigmoid**   | Cubic spline interpolation based on pre-defined inflection points and maximum weight.                               | `balance` - Token balance of the voter.<br>`inflectionPoint` - Balance at which voting power inflects (default: 10000).<br>`maxWeight` - Maximum voting weight (default: 50000). | `sigmoid(1000)`                          |

## Snapshot Balance Averaging Methods

| Method                         | Description                                                                                          | Parameters                                                                                            | Example Usage                                    |
|--------------------------------|------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|--------------------------------------------------|
| **Simple Moving Average**      | Averages balances over a specified period, giving equal weight to all balances.                      | `series` - Array of balances.<br>`period` - Length of moving average window.<br>`precision` - Significant digits (default: 5). | `simple([100, 200, 300], 2)`                     |
| **Exponential Moving Average** | Averages balances with exponentially decreasing weights over time.                                   | `series` - Array of balances.<br>`period` - Length of moving average window.<br>`precision` - Significant digits (default: 5). | `exponential([100, 200, 300], 2)`                |
| **Smoothed Moving Average**    | Smooths the moving average by considering past averages.                                             | `series` - Array of balances.<br>`period` - Length of moving average window.<br>`precision` - Significant digits (default: 5). | `smoothed([100, 200, 300], 2)`                   |
| **Weighted Moving Average**    | Averages balances with specified weights for each data point in the period.                          | `series` - Array of balances.<br>`weights` - Array of weights.<br>`precision` - Significant digits (default: 5). | `weighted([100, 200, 300], [0.5, 0.3, 0.2])`     |
| **Linear Regression**          | Calculates a trendline for the time series using linear regression.                                  | `series` - Array of balances.<br>`period` - Length of window (optional).<br>`precision` - Significant digits (default: 5). | `linearRegression([100, 200, 300], 2)`           |

## Why Yap?

Existing platforms often fall short in terms of UX, performance, or the availability of sophisticated voting schemes and balance snapshotting capabilities. Yap addresses these shortcomings, providing a holistic solution for DAO governance.

## Tech Stack

* **Backend:** Bun, ethers v6, Redis (for logging and backups)
* **Frontend:** Vue3, web3modal, ethers v6

## Installation & Deployment

Yap is currently under active development. A Docker-based setup for simplified deployment is in the works and will be available soon.

## Contributing

We welcome contributions from the community! If you're interested in helping to improve Yap, please feel free to submit pull requests or open issues on our GitHub repository.

## Disclaimer

Yap is a work in progress. While we strive for accuracy and reliability, please use the platform with caution and at your own risk. We are not responsible for any losses or damages incurred through the use of Yap.