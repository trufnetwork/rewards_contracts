import {HardhatRuntimeEnvironment} from "hardhat/types";
import {task, types} from "hardhat/config";

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
