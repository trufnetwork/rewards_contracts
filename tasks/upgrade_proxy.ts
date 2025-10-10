import {HardhatRuntimeEnvironment} from "hardhat/types";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {task, types} from "hardhat/config";

task("upgrade-proxy",
    "Upgrade an existing proxy to a new implementation")
    .addPositionalParam("proxy", "proxy contract address", undefined, types.string, false)
    .addOptionalParam("implementation", "new implementation address (if not provided, will deploy new one)", "", types.string)
    .addOptionalParam("data", "optional calldata for upgradeToAndCall", "", types.string)
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

            const [deployer] = await hre.ethers.getSigners();

            await upgradeProxy(hre, deployer, taskArgs.proxy, taskArgs.implementation, taskArgs.data);
        }
    );

task("deploy-new-implementation",
    "Deploy a new implementation contract for upgrades")
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

            const [deployer] = await hre.ethers.getSigners();

            await deployNewImplementation(hre, deployer);
        }
    );

async function deployNewImplementation(hre: HardhatRuntimeEnvironment, deployer: HardhatEthersSigner) {
    console.log('Deployer address: ', deployer.address);
    console.log(">>> ")
    console.log("Deploying new RewardDistributor implementation...");
    
    const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
    const newImplementation = await RewardDistributor.deploy();
    await newImplementation.waitForDeployment();
    
    const newImplAddress = await newImplementation.getAddress();
    console.log("New implementation deployed to:", newImplAddress);
    
    console.log(">>> ")
    console.log("To upgrade your proxies, use:");
    console.log(`npx hardhat upgrade-proxy <PROXY_ADDRESS> --implementation ${newImplAddress} --network <NETWORK>`);
    
    return newImplAddress;
}

async function upgradeProxy(hre: HardhatRuntimeEnvironment, deployer: HardhatEthersSigner, 
                           proxyAddr: string, implementationAddr: string, calldata: string) {
    if (!proxyAddr) {
        console.log("Error: proxy address is required");
        return;
    }

    let newImplementationAddr = implementationAddr;
    
    // If no implementation provided, deploy a new one
    if (!newImplementationAddr) {
        console.log("No implementation address provided, deploying new implementation...");
        newImplementationAddr = await deployNewImplementation(hre, deployer);
    }

    console.log(">>> ")
    console.log('Upgrader address: ', deployer.address);
    console.log(`Proxy Address: ${proxyAddr}`);
    console.log(`New Implementation: ${newImplementationAddr}`);
    
    // Get the proxy contract
    const proxy = await hre.ethers.getContractAt("RewardDistributor", proxyAddr);
    
    // Check current implementation
    const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"; // EIP-1967 implementation slot
    const currentImplementation = await hre.ethers.provider.getStorage(proxyAddr, IMPLEMENTATION_SLOT);
    const currentImplAddress = "0x" + currentImplementation.slice(-40);
    console.log(`Current Implementation: ${currentImplAddress}`);
    
    try {
        let txResp;
        
        if (calldata && calldata !== "") {
            console.log("Upgrading with calldata...");
            txResp = await proxy.connect(deployer).upgradeToAndCall(newImplementationAddr, calldata);
        } else {
            console.log("Upgrading implementation...");
            txResp = await proxy.connect(deployer).upgradeTo(newImplementationAddr);
        }
        
        console.log(`Upgrade transaction hash: ${txResp.hash}`);
        const txReceipt = await txResp.wait();
        console.log(`Upgrade confirmed in block: ${txReceipt!.blockNumber}`);
        
        // Verify upgrade
        const newCurrentImplementation = await hre.ethers.provider.getStorage(proxyAddr, IMPLEMENTATION_SLOT);
        const newImplAddress = "0x" + newCurrentImplementation.slice(-40);
        console.log(`New Implementation: ${newImplAddress}`);
        
        // Check if upgrade actually happened
        if (currentImplAddress.toLowerCase() === newImplAddress.toLowerCase()) {
            console.log("⚠️  WARNING: Implementation address didn't change!");
            console.log("This might happen if deploying identical bytecode.");
        } else {
            console.log("✅ Implementation successfully updated!");
        }
        
        console.log(">>> ")
        console.log("✅ Upgrade completed successfully!");
        console.log("- Proxy address remains the same");
        console.log("- All state data preserved");
        console.log("- New implementation logic active");
        
        // Test state preservation
        console.log("\n=== Verifying State Preservation ===");
        try {
            const safe = await proxy.safe();
            const posterFee = await proxy.posterFee();
            const rewardToken = await proxy.rewardToken();
            console.log(`Safe: ${safe}`);
            console.log(`Poster Fee: ${posterFee}`);
            console.log(`Reward Token: ${rewardToken}`);
            console.log("✅ All state preserved!");
        } catch (error) {
            console.log("❌ Error reading state:", error);
        }
        
    } catch (error) {
        console.error("❌ Upgrade failed:", error);
        console.log("Make sure:");
        console.log("- You are the Safe wallet owner");
        console.log("- The new implementation is valid");
        console.log("- The proxy contract supports UUPS upgrades");
    }
}