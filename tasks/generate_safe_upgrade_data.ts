import {task, types} from "hardhat/config";

task("generate-safe-upgrade-data",
    "Generate transaction data for upgrading a proxy through Safe web interface")
    .addPositionalParam("proxy", "proxy contract address", undefined, types.string, false)
    .addPositionalParam("implementation", "new implementation address", undefined, types.string, false)
    .addOptionalParam("data", "optional calldata for upgradeToAndCall", "0x", types.string)
    .setAction(
        async (taskArgs, hre) => {
            const proxyAddress = taskArgs.proxy;
            const newImplementation = taskArgs.implementation;
            const calldata = taskArgs.data;

            // Validate addresses
            if (!hre.ethers.isAddress(proxyAddress)) {
                throw new Error(`Invalid proxy address: ${proxyAddress}`);
            }
            if (!hre.ethers.isAddress(newImplementation)) {
                throw new Error(`Invalid implementation address: ${newImplementation}`);
            }
            
            console.log("=== SAFE TRANSACTION DATA ===");
            console.log("");
            console.log("Proxy Address:", proxyAddress);
            console.log("New Implementation:", newImplementation);
            console.log("Additional Calldata:", calldata);
            console.log("");
            
            // upgradeToAndCall function signature: upgradeToAndCall(address,bytes)
            const RewardDistributor = await hre.ethers.getContractFactory("RewardDistributor");
            const upgradeFunc = RewardDistributor.interface.getFunction("upgradeToAndCall");
            if (!upgradeFunc) {
                throw new Error("upgradeToAndCall function not found in RewardDistributor interface");
            }
            const functionSelector = upgradeFunc.selector;
            const encodedParams = hre.ethers.AbiCoder.defaultAbiCoder().encode(
                ["address", "bytes"], 
                [newImplementation, calldata]
            );
            
            const txData = functionSelector + encodedParams.slice(2);
            
            console.log("=== COPY THESE VALUES TO SAFE WEB INTERFACE ===");
            console.log("");
            console.log("To Address:", proxyAddress);
            console.log("ETH Value:", "0");
            console.log("Data (hex):", txData);
            console.log("");
            console.log("=== INSTRUCTIONS ===");
            console.log("1. Go to Safe web interface");
            console.log("2. Create new transaction");
            console.log("3. Paste the 'To Address' above");
            console.log("4. Set ETH Value to 0");
            console.log("5. Paste the 'Data (hex)' above");
            console.log("6. Submit and execute the transaction");
            console.log("");
            console.log("This will upgrade your proxy to the new implementation!");
        }
    );