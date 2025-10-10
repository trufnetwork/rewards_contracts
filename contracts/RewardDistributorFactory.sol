// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";
import "./IRewardDistributor.sol";
import "./RewardDistributor.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract RewardDistributorFactory is Ownable {
    address public implementation;

    event Created(address instance);
    event ImplementationUpdated(address oldImpl, address newImpl);

    constructor(address _owner, address _implementation) Ownable(_owner) {
        implementation = _implementation;
    }

    function create(
        address _safe,
        uint256 _posterFee,
        address _rewardToken,
        bytes32 salt
    )
    external
    onlyOwner
    {
        // Encode the initialize function call
        bytes memory initData = abi.encodeWithSelector(
            RewardDistributor.initialize.selector,
            _safe,
            _posterFee,
            _rewardToken
        );
        
        // Deploy upgradeable proxy
        address instance = address(new ERC1967Proxy{salt: salt}(
            implementation,
            initData
        ));

        console.logAddress(instance);
        emit Created(instance);
    }

    function predicateAddr(bytes32 salt)
    public
    view
    returns (address predicted)
    {
        // Calculate CREATE2 address for ERC1967Proxy
        // NOTE: placeholder params used only for address prediction
        bytes memory bytecode = abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(
                implementation,
                abi.encodeWithSelector(
                    RewardDistributor.initialize.selector,
                    address(0), // placeholder - actual values will be provided at deploy
                    0,           // placeholder - actual values will be provided at deploy
                    address(0)   // placeholder - actual values will be provided at deploy
                )
            )
        );
        
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            address(this),
            salt,
            keccak256(bytecode)
        )))));
    }
    
    /// @notice Update implementation address
    /// @param _newImplementation New implementation contract address
    function updateImplementation(address _newImplementation) external onlyOwner {
        require(_newImplementation != address(0), "Invalid implementation");
        
        address oldImpl = implementation;
        implementation = _newImplementation;
        
        emit ImplementationUpdated(oldImpl, _newImplementation);
    }
}