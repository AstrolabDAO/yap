// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract AirDropLocker is Ownable, Pausable, ReentrancyGuard {

  using SafeERC20 for IERC20;

  IERC20 public token;
  address public keeper;
  mapping(address => uint256) public allowances;
  mapping(address => uint256) public claimed;

  event AllowanceSet(address indexed user, uint256 amount);
  event Claimed(address indexed user, uint256 amount);
  event Deposit(address indexed admin, uint256 amount);
  event Withdraw(address indexed admin, uint256 amount);

  constructor(address _owner, address _keeper, address _token) Ownable(_owner) {
    token = IERC20(_token);
    keeper = _keeper;
  }

  modifier onlyKeeper() {
    require(msg.sender == keeper, "Not keeper");
    _;
  }

  function setAllowance(address user, uint256 amount) external onlyKeeper whenNotPaused {
    allowances[user] = amount;
    emit AllowanceSet(user, amount);
  }

  function addAllowance(address user, uint256 amount) external onlyKeeper whenNotPaused {
    allowances[user] += amount;
    emit AllowanceSet(user, allowances[user]);
  }

  function claim(uint256 amount) external whenNotPaused nonReentrant {
    require(amount <= allowances[msg.sender], "Exceeds allowance");
    require(amount <= token.balanceOf(address(this)), "Insufficient contract balance");

    allowances[msg.sender] -= amount;
    claimed[msg.sender] += amount;
    token.safeTransfer(msg.sender, amount);
    emit Claimed(msg.sender, amount);
  }

  function deposit(uint256 amount) external onlyOwner {
    token.safeTransferFrom(msg.sender, address(this), amount);
    emit Deposit(msg.sender, amount);
  }

  function withdraw(uint256 amount) external onlyOwner {
    require(amount <= token.balanceOf(address(this)), "Insufficient contract balance");
    token.safeTransfer(msg.sender, amount);
    emit Withdraw(msg.sender, amount);
  }

  function setKeeper(address _keeper) external onlyOwner {
    keeper = _keeper;
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }
}
