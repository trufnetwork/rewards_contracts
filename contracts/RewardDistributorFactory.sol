// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";
import "./IRewardDistributor.sol";
import "./RewardDistributor.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/interfaces/IERC1967.sol";

contract RewardDistributorFactory is Ownable {
    address public proxy;
    address public implementation;
    ProxyAdmin public proxyAdmin;

    event ProxyCreated(address proxy);
    event ImplementationUpgraded(address oldImplementation, address newImplementation);

    constructor(address _owner, address _implementation) Ownable(_owner) {
        implementation = _implementation;
        proxyAdmin = new ProxyAdmin(address(this));
    }

    function createProxy(
        address _safe,
        uint256 _posterFee,
        address _rewardToken
    )
    external
    onlyOwner
    {
        require(proxy == address(0), "Proxy already created");
        
        bytes memory initData = abi.encodeWithSignature(
            "setup(address,uint256,address)",
            _safe,
            _posterFee,
            _rewardToken
        );
        
        proxy = address(new TransparentUpgradeableProxy(
            implementation,
            address(proxyAdmin),
            initData
        ));
        
        console.logAddress(proxy);
        emit ProxyCreated(proxy);
    }

    function getProxy()
    public
    view
    returns (address)
    {
        return proxy;
    }

    function upgradeImplementation(address _newImplementation) external onlyOwner {
        require(proxy != address(0), "No proxy deployed");
        require(_newImplementation != address(0), "Invalid implementation address");
        
        address oldImplementation = implementation;
        implementation = _newImplementation;
        
        proxyAdmin.upgradeAndCall(
            ITransparentUpgradeableProxy(proxy),
            _newImplementation,
            ""
        );
        
        emit ImplementationUpgraded(oldImplementation, _newImplementation);
    }
}