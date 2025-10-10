import {HardhatRuntimeEnvironment} from "hardhat/types";
import {task, types} from "hardhat/config";
import * as fs from 'fs';

task("verify-proxy",
    "Verify upgradeable proxy contract on Etherscan")
    .addPositionalParam("proxy", "proxy contract address", undefined, types.string, false)
    .addOptionalParam("argsFile", "custom arguments file path", "proxy-verify-args.js", types.string)
    .setAction(
        async (taskArgs, hre) => {
            console.log(`Verifying proxy contract: ${taskArgs.proxy}`);
            console.log(`Network: ${hre.network.name}`);
            
            try {
                // Get proxy contract to read current state
                const proxy = await hre.ethers.getContractAt("RewardDistributor", taskArgs.proxy);
                
                console.log("\n=== Reading Proxy State ===");
                const safe = await proxy.safe();
                const posterFee = await proxy.posterFee();
                const rewardToken = await proxy.rewardToken();
                
                console.log(`Safe: ${safe}`);
                console.log(`Poster Fee: ${posterFee}`);
                console.log(`Reward Token: ${rewardToken}`);
                
                // Get implementation address from storage
                const IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
                const implStorage = await hre.ethers.provider.getStorage(taskArgs.proxy, IMPLEMENTATION_SLOT);
                const implementation = "0x" + implStorage.slice(-40);
                
                console.log(`Implementation: ${implementation}`);
                
                // Encode the initialization data
                const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
                const initData = RewardDistributor.interface.encodeFunctionData("initialize", [
                    safe,
                    posterFee,
                    rewardToken
                ]);
                
                console.log(`Init Data: ${initData}`);
                
                // Create arguments file
                const argsContent = `// Proxy verification arguments for ERC1967Proxy
// Generated automatically for proxy: ${taskArgs.proxy}
module.exports = [
  "${implementation}", // implementation address
  "${initData}" // initialize(safe, posterFee, rewardToken) encoded data
];`;
                
                fs.writeFileSync(taskArgs.argsFile, argsContent);
                console.log(`\n✅ Arguments saved to: ${taskArgs.argsFile}`);
                
                // Attempt verification
                console.log("\n=== Attempting Verification ===");
                
                try {
                    await hre.run("verify:verify", {
                        address: taskArgs.proxy,
                        constructorArguments: [implementation, initData],
                        network: hre.network.name
                    });
                    
                    console.log("✅ Proxy verification successful!");
                    
                } catch (verifyError: any) {
                    if (verifyError.message.includes("Already Verified")) {
                        console.log("✅ Contract is already verified!");
                    } else {
                        console.log("❌ Automatic verification failed:");
                        console.log(verifyError.message);
                        
                        console.log("\n=== Manual Verification Command ===");
                        console.log(`npx hardhat verify --network ${hre.network.name} ${taskArgs.proxy} --constructor-args ${taskArgs.argsFile}`);
                        
                        console.log("\n=== Alternative Manual Command ===");
                        console.log(`npx hardhat verify --network ${hre.network.name} ${taskArgs.proxy} \\`);
                        console.log(`  "${implementation}" \\`);
                        console.log(`  "${initData}"`);
                    }
                }
                
            } catch (error) {
                console.error("❌ Error reading proxy data:", error);
                console.log("\nThis might happen if:");
                console.log("- The proxy is not properly deployed");
                console.log("- The proxy is not an upgradeable contract");
                console.log("- Network connection issues");
                
                console.log("\n=== Manual Verification Steps ===");
                console.log("1. Get implementation address:");
                console.log(`   npx hardhat check-implementation ${taskArgs.proxy} --network ${hre.network.name}`);
                console.log("2. Get initialization parameters from deployment logs");
                console.log("3. Encode init data manually and verify");
            }
        }
    );

task("verify-implementation",
    "Verify implementation contract (no constructor args needed)")
    .addPositionalParam("implementation", "implementation contract address", undefined, types.string, false)
    .setAction(
        async (taskArgs, hre) => {
            console.log(`Verifying implementation: ${taskArgs.implementation}`);
            console.log(`Network: ${hre.network.name}`);
            
            try {
                await hre.run("verify:verify", {
                    address: taskArgs.implementation,
                    constructorArguments: [],
                    network: hre.network.name
                });
                
                console.log("✅ Implementation verification successful!");
                
            } catch (error: any) {
                if (error.message.includes("Already Verified")) {
                    console.log("✅ Contract is already verified!");
                } else {
                    console.error("❌ Verification failed:", error.message);
                    
                    console.log("\n=== Manual Command ===");
                    console.log(`npx hardhat verify --network ${hre.network.name} ${taskArgs.implementation}`);
                }
            }
        }
    );

task("verify-factory",
    "Verify factory contract with constructor arguments")
    .addPositionalParam("factory", "factory contract address", undefined, types.string, false)
    .addPositionalParam("owner", "owner address (deployer)", undefined, types.string, false)
    .addPositionalParam("implementation", "implementation address", undefined, types.string, false)
    .setAction(
        async (taskArgs, hre) => {
            console.log(`Verifying factory: ${taskArgs.factory}`);
            console.log(`Owner: ${taskArgs.owner}`);
            console.log(`Implementation: ${taskArgs.implementation}`);
            console.log(`Network: ${hre.network.name}`);
            
            try {
                await hre.run("verify:verify", {
                    address: taskArgs.factory,
                    constructorArguments: [taskArgs.owner, taskArgs.implementation],
                    network: hre.network.name
                });
                
                console.log("✅ Factory verification successful!");
                
            } catch (error: any) {
                if (error.message.includes("Already Verified")) {
                    console.log("✅ Contract is already verified!");
                } else {
                    console.error("❌ Verification failed:", error.message);
                    
                    console.log("\n=== Manual Command ===");
                    console.log(`npx hardhat verify --network ${hre.network.name} ${taskArgs.factory} \\`);
                    console.log(`  "${taskArgs.owner}" \\`);
                    console.log(`  "${taskArgs.implementation}"`);
                }
            }
        }
    );