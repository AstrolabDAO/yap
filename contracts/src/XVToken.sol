// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/Strings.sol"; // import strings library
import "@axelar-network/contracts/interfaces/IAxelarGateway.sol";
import "@axelar-network/contracts/interfaces/IAxelarGasService.sol";

contract XVToken is ERC20, Ownable2Step {
  using Strings for uint256;
  using Strings for address;
  using Strings for bytes32;

  IAxelarGateway public gateway; // axelar gateway interface
  IAxelarGasService public gasService; // axelar gas service interface

  uint256 public ownershipCooldown = 3 days; // cooldown period for ownership transfer
  uint256 public ownershipAcceptanceWindow = 2 days; // acceptance window for ownership transfer

 mapping(bytes32 => mapping(address => uint256)) public nonces;

  event CrossChainTransfer(
    address indexed from,
    bytes32 destinationChain,
    address destinationAddress,
    uint256 amount,
    uint256 nonce
  ); // cross-chain transfer event
  event OwnershipCooldownUpdated(uint256 newCooldown); // ownership cooldown updated event
  event OwnershipAcceptanceWindowUpdated(uint256 newAcceptanceWindow); // ownership acceptance window updated event
  event GasServiceUpdated(address newGasService); // gas service updated event
  event GatewayUpdated(address newGateway); // gateway updated event
  event Mint(address indexed to, uint256 amount); // mint event
  event Burn(address indexed from, uint256 amount); // burn event

  constructor(
    string memory _name,
    string memory _symbol,
    address _owner,
    address _gateway,
    address _gasService
  ) ERC20(_name, _symbol) Ownable(_owner) {
    require(_gateway != address(0), "Gateway address cannot be zero");
    require(
      _gasService != address(0),
      "Gas service address cannot be zero"
    );

    gateway = IAxelarGateway(_gateway);
    gasService = IAxelarGasService(_gasService);
  }

  /**
   * @notice Mints new tokens to the specified address
   * @param to The address to mint tokens to
   * @param amount The amount of tokens to mint
   */
  function mint(address to, uint256 amount) external onlyOwner {
    _mint(to, amount);
    emit Mint(to, amount); // emit mint event
  }

  /**
   * @notice Burns the specified amount of tokens from the caller's balance
   * @param amount The amount of tokens to burn
   */
  function burn(uint256 amount) external {
    _burn(msg.sender, amount);
    emit Burn(msg.sender, amount); // emit burn event
  }

  // disable standard transfers
  function transfer(address, uint256) public pure override returns (bool) {
    revert("Transfers are disabled");
  }

  // disable standard transferFrom
  function transferFrom(
    address,
    address,
    uint256
  ) public pure override returns (bool) {
    revert("Transfers are disabled");
  }

  /**
   * @notice Transfers tokens across chains by burning on source and minting on destination
   * @param destinationChain The destination chain name
   * @param amount The amount of tokens to transfer
   */
  function crossChainTransfer(
    bytes32 destinationChain,
    uint256 amount
  ) external payable {
    require(
      destinationChain != bytes32(0),
      "Destination chain is required"
    );
    require(amount > 0, "Amount must be greater than 0");

    _burn(msg.sender, amount);
    uint256 nonce = nonces[destinationChain][msg.sender];
    bytes memory payload = abi.encode(
      msg.sender,
      amount,
      nonce
    );
    nonces[destinationChain][msg.sender]++;

    string memory dstChainStr = string(
      abi.encodePacked(destinationChain)
    );
    string memory dstAddrStr = address(this).toHexString();

    if (msg.value > 0) {
      gasService.payNativeGasForContractCall{value: msg.value}(
        address(this),
        dstChainStr,
        dstAddrStr,
        payload,
        msg.sender
      );
    }

    gateway.callContract(
      dstChainStr,
      dstAddrStr,
      payload
    );

    emit CrossChainTransfer(
      msg.sender,
      destinationChain,
      msg.sender,
      amount,
      nonce
    ); // emit cross-chain transfer event
  }

  /**
   * @notice Executes the cross-chain transfer on the destination chain
   * @param sourceChain The source chain name
   * @param payload The data payload containing the recipient address, amount, and nonce
   */
  function executeCrossChainTransfer(
    bytes32 sourceChain,
    bytes calldata payload
  ) external {
    require(
      msg.sender == address(gateway),
      "Only gateway can call this function"
    );

    (address recipient, uint256 amount, uint256 nonce) = abi.decode( // recipient == sender
      payload,
      (address, uint256, uint256)
    );
    require(nonce == nonces[sourceChain][msg.sender]++, "Invalid nonce");

    _mint(recipient, amount);
  }

  /**
   * @notice Updates the ownership cooldown period
   * @param newCooldown The new cooldown period in seconds
   */
  function setOwnershipCooldown(uint256 newCooldown) external onlyOwner {
    require(newCooldown > 0, "Cooldown must be greater than 0");
    ownershipCooldown = newCooldown;
    emit OwnershipCooldownUpdated(newCooldown); // emit ownership cooldown updated event
  }

  /**
   * @notice Updates the ownership acceptance window period
   * @param newAcceptanceWindow The new acceptance window period in seconds
   */
  function setOwnershipAcceptanceWindow(
    uint256 newAcceptanceWindow
  ) external onlyOwner {
    require(
      newAcceptanceWindow > 0,
      "Acceptance window must be greater than 0"
    );
    ownershipAcceptanceWindow = newAcceptanceWindow;
    emit OwnershipAcceptanceWindowUpdated(newAcceptanceWindow); // emit ownership acceptance window updated event
  }

  /**
   * @notice Updates the gas service address
   * @param newGasService The new gas service address
   */
  function setGasService(address newGasService) external onlyOwner {
    require(
      newGasService != address(0),
      "Gas service address cannot be zero"
    );
    gasService = IAxelarGasService(newGasService);
    emit GasServiceUpdated(newGasService); // emit gas service updated event
  }

  /**
   * @notice Updates the gateway address
   * @param newGateway The new gateway address
   */
  function setGateway(address newGateway) external onlyOwner {
    require(newGateway != address(0), "Gateway address cannot be zero");
    gateway = IAxelarGateway(newGateway);
    emit GatewayUpdated(newGateway); // emit gateway updated event
  }

  uint256 public pendingOwnershipTimestamp;

  // override transferOwnership to include cooldown and acceptance window logic
  function transferOwnership(address newOwner) public override onlyOwner {
    super.transferOwnership(newOwner);
    pendingOwnershipTimestamp = block.timestamp + ownershipCooldown;
  }

  /**
   * @notice Accepts the pending ownership transfer
   */
  function acceptOwnership() public override {
    require(
      block.timestamp >= pendingOwnershipTimestamp,
      "Ownership transfer cooldown not met"
    );
    require(
      block.timestamp <=
        pendingOwnershipTimestamp + ownershipAcceptanceWindow,
      "Ownership acceptance window expired"
    );
    super.acceptOwnership();
  }
}
