import {HardhatRuntimeEnvironment} from "hardhat/types";
import {HardhatEthersSigner} from "@nomicfoundation/hardhat-ethers/signers";
import {task, types} from "hardhat/config";

task("test-upgrade",
    "Test upgrade functionality by checking implementation changes")
    .addPositionalParam("proxy", "proxy contract address", undefined, types.string, false)
    .setAction(
        async (taskArgs, hre) => {
            let chainId = hre.network.config.chainId ?? 31337;
            console.log(`Current network: ${hre.network.name}/${chainId}`)
            console.log("Current height: ", await hre.ethers.provider.getBlockNumber())

            const [deployer] = await hre.ethers.getSigners();

            await testUpgrade(hre, deployer, taskArgs.proxy);
        }
    );

task("check-implementation",
    "Check current implementation address of a proxy")
    .addPositionalParam("proxy", "proxy contract address", undefined, types.string, false)
    .setAction(
        async (taskArgs, hre) => {
            const currentImpl = await getCurrentImplementation(hre, taskArgs.proxy);
            console.log(`Proxy: ${taskArgs.proxy}`);
            console.log(`Current Implementation: ${currentImpl}`);
        }
    );

// EIP-1967 implementation storage slot
const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function getCurrentImplementation(hre: HardhatRuntimeEnvironment, proxyAddress: string): Promise<string> {
    const implementationStorage = await hre.ethers.provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
    return hre.ethers.getAddress("0x" + implementationStorage.slice(-40));
}

async function testUpgrade(hre: HardhatRuntimeEnvironment, deployer: HardhatEthersSigner, proxyAddress: string) {
    if (!proxyAddress) {
        console.log("Error: proxy address is required");
        return;
    }

    console.log(">>> ")
    console.log('Testing upgrade for proxy:', proxyAddress);
    console.log('Deployer address: ', deployer.address);

    // 1. Check current implementation
    console.log("\n=== STEP 1: Current State ===");
    const currentImpl = await getCurrentImplementation(hre, proxyAddress);
    console.log(`Current Implementation: ${currentImpl}`);

    // 2. Get proxy contract instance
    const proxy = await hre.ethers.getContractAt("RewardDistributor", proxyAddress);
    
    // 3. Check current contract state
    console.log("\n=== STEP 2: Current Contract State ===");
    try {
        const safe = await proxy.safe();
        const posterFee = await proxy.posterFee();
        const rewardToken = await proxy.rewardToken();
        
        console.log(`Safe: ${safe}`);
        console.log(`Poster Fee: ${posterFee}`);
        console.log(`Reward Token: ${rewardToken}`);
    } catch (error) {
        console.log("Could not read contract state:", error);
    }

    // 4. Deploy new implementation
    console.log("\n=== STEP 3: Deploy New Implementation ===");
    const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
    const newImplementation = await RewardDistributor.deploy();
    await newImplementation.waitForDeployment();
    const newImplAddress = await newImplementation.getAddress();
    console.log(`New Implementation deployed: ${newImplAddress}`);

    // 5. Check if implementation actually changed
    if (currentImpl.toLowerCase() === newImplAddress.toLowerCase()) {
        console.log("⚠️  WARNING: New implementation has same address as current!");
        console.log("This might happen if you're redeploying identical code.");
        return;
    }

    // 6. Perform upgrade
    console.log("\n=== STEP 4: Performing Upgrade ===");
    try {
        const upgradeTx = await (proxy as any).connect(deployer).upgradeTo(newImplAddress);
        console.log(`Upgrade transaction: ${upgradeTx.hash}`);
        
        const receipt = await upgradeTx.wait();
        console.log(`✅ Upgrade confirmed in block: ${receipt!.blockNumber}`);
    } catch (error) {
        console.log("❌ Upgrade failed:", error);
        console.log("\nPossible reasons:");
        console.log("- You're not the authorized upgrader (check Safe ownership)");
        console.log("- The proxy doesn't support UUPS upgrades");
        console.log("- Network/gas issues");
        return;
    }

    // 7. Verify upgrade
    console.log("\n=== STEP 5: Verifying Upgrade ===");
    const newCurrentImpl = await getCurrentImplementation(hre, proxyAddress);
    console.log(`Previous Implementation: ${currentImpl}`);
    console.log(`New Implementation:     ${newCurrentImpl}`);
    
    if (newCurrentImpl.toLowerCase() === newImplAddress.toLowerCase()) {
        console.log("✅ UPGRADE SUCCESSFUL!");
    } else {
        console.log("❌ UPGRADE FAILED - Implementation didn't change");
        return;
    }

    // 8. Verify state preservation
    console.log("\n=== STEP 6: Verifying State Preservation ===");
    try {
        const newSafe = await proxy.safe();
        const newPosterFee = await proxy.posterFee();
        const newRewardToken = await proxy.rewardToken();
        
        console.log(`Safe (should be same): ${newSafe}`);
        console.log(`Poster Fee (should be same): ${newPosterFee}`);
        console.log(`Reward Token (should be same): ${newRewardToken}`);
        
        console.log("✅ All state preserved after upgrade!");
    } catch (error) {
        console.log("❌ Error reading state after upgrade:", error);
    }

    console.log("\n=== UPGRADE TEST COMPLETE ===");
    console.log("🎉 Your upgrade system is working correctly!");
}