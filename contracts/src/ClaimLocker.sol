// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ClaimLocker
 * @notice This contract manages the distribution of ERC20 tokens with customizable allowances and a cooldown period
 * @dev Only the owner can deposit and withdraw tokens, while a designated keeper manages allowances
 */
contract ClaimLocker is Ownable, Pausable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  IERC20 public token;
  address public keeper;
  uint256 public claimCooldown = 1 days;
  uint256 public lastDeposit;

  mapping(address => uint256) public lastAllowed;
  mapping(address => uint256) public allowances;
  mapping(address => uint256) public claimed;

  event AllowanceSet(address indexed user, uint256 amount);
  event Claimed(address indexed user, uint256 amount);
  event Deposit(address indexed admin, uint256 amount);
  event Withdraw(address indexed admin, uint256 amount);

  /**
   * @notice Initializes the contract with the owner, keeper, and token addresses
   * @param _owner The address of the contract owner
   * @param _keeper The address of the account authorized to manage allowances
   * @param _token The address of the ERC20 token to be distributed
   */
  constructor(address _owner, address _keeper, address _token) Ownable(_owner) {
    token = IERC20(_token);
    keeper = _keeper;
  }

  modifier onlyKeeper() {
    require(msg.sender == keeper, "Not keeper");
    _;
  }

  /**
   * @notice Sets the token allowance for a specific user
   * @dev Only callable by the keeper
   * @param user The address of the user to set the allowance for
   * @param amount The amount of tokens to be allowed
   */
  function _setAllowance(address user, uint256 amount) internal {
    allowances[user] = amount;
    lastAllowed[msg.sender] = block.timestamp;
    emit AllowanceSet(user, amount);
  }

  /**
   * @notice Sets the token allowance for a specific user
   * @dev Only callable by the keeper
   * @param user The address of the user to set the allowance for
   * @param amount The amount of tokens to be allowed
   */
  function setAllowance(address user, uint256 amount) external onlyKeeper whenNotPaused {
    _setAllowance(user, amount);
  }

  /**
   * @notice Adds to the token allowance for a specific user
   * @dev Only callable by the keeper
   * @param user The address of the user to set the allowance for
   * @param amount The amount of tokens to add to the allowance
   */
  function addAllowance(address user, uint256 amount) external onlyKeeper whenNotPaused {
    _setAllowance(user, allowances[user] + amount);
  }

  /**
   * @notice Allows a user to claim their allowed amount of tokens
   * @dev Reverts if the requested amount exceeds the user's allowance or the contract's balance
   * @param amount The amount of tokens to claim
   */
  function claim(uint256 amount) external whenNotPaused nonReentrant {
    require(amount <= allowances[msg.sender]); // no overclaim
    require(amount <= token.balanceOf(address(this))); // no overdraw
    require(block.timestamp - lastAllowed[msg.sender] >= claimCooldown); // cooldown check
    allowances[msg.sender] -= amount;
    claimed[msg.sender] += amount;
    token.safeTransfer(msg.sender, amount);
    emit Claimed(msg.sender, amount);
  }

  /**
   * @notice Deposits tokens into the contract for distribution
   * @dev Only callable by the owner
   * @param amount The amount of tokens to deposit
   */
  function deposit(uint256 amount) external nonReentrant {
    require(amount > 0); // min deposit == 1
    lastDeposit = block.timestamp; // reset cooldown
    token.safeTransferFrom(msg.sender, address(this), amount);
    emit Deposit(msg.sender, amount);
  }

  /**
   * @notice Withdraws tokens from the contract
   * @dev Only callable by the owner
   * @param amount The amount of tokens to withdraw
   */
  function withdraw(uint256 amount) external onlyOwner {
    require(amount <= token.balanceOf(address(this))); // no overdraw
    token.safeTransfer(msg.sender, amount);
    emit Withdraw(msg.sender, amount);
  }


  /**
   * @notice Sets the address of the keeper
   * @dev Only callable by the owner
   * @param _keeper The address of the new keeper
   */
  function setKeeper(address _keeper) external onlyOwner {
    keeper = _keeper;
  }

  /**
   * @notice Sets the claim cooldown period
   * @dev Only callable by the owner
   * @param _claimCooldown The new claim cooldown period in seconds
   */
  function setClaimCooldown(uint256 _claimCooldown) external onlyOwner {
    claimCooldown = _claimCooldown;
  }

  /**
   * @notice Pauses the contract, preventing claims and allowance changes
   * @dev Only callable by the owner
   */
  function pause() external onlyOwner {
    _pause();
  }

  /**
   * @notice Unpauses the contract, allowing claims and allowance changes
   * @dev Only callable by the owner
   */
  function unpause() external onlyOwner {
    _unpause();
  }
}
