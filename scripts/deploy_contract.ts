import hre from "hardhat";
import RewardDistributorModule from "../ignition/modules/RewardDistributor";
import RewardDistributorSafeModule from "../ignition/modules/RewardDistributorSafe";
import KwilMockToken from "../ignition/modules/KwilMockToken";
import { parseUnits } from "ethers";

import dotenv from 'dotenv';
dotenv.config();


async function localhost() {
    const [deployer, fakeSafe] = await hre.ethers.getSigners();

    const {mockToken} = await hre.ignition.deploy(KwilMockToken, {
        defaultSender: deployer.address,
        parameters: {
            KwilMockToken: {
                owner: deployer.address,
            }
        },
        config: {
            requiredConfirmations: 1,
        },
    });

    console.log(`MockToken deployed to: ${await mockToken.getAddress()}`);

    const { rd } = await hre.ignition.deploy(RewardDistributorModule, {
        parameters: {
            RewardDistributor: {
                safe: fakeSafe.address,
                posterFee: parseUnits("0.001", "ether"),
                rewardToken: await mockToken.getAddress(),
            },
        },
        defaultSender: deployer.address,
        config: {
            requiredConfirmations: 1,
        },
    });

    console.log(`Contract deployed to: ${await rd.getAddress()}`);

    await mockToken.transfer((await rd.getAddress()), parseUnits("1000", "ether"));
    console.log("Contract's initial token balance", await mockToken.balanceOf(await rd.getAddress()))
}

async function sepolia(safeAddr: string) {
    const [deployer] = await hre.ethers.getSigners();

    const {mockToken} = await hre.ignition.deploy(KwilMockToken, {
        defaultSender: deployer.address,
        parameters: {
            KwilMockToken: {
                owner: deployer.address,
            }
        },
        config: {
            requiredConfirmations: 5,
        },
    });

    console.log(`MockToken deployed to: ${await mockToken.getAddress()}`);

    const { rd } = await hre.ignition.deploy(RewardDistributorSafeModule, {
        parameters: {
            RewardDistributor: {
                safe: safeAddr!,
                posterFee: parseUnits("0.001", "ether"),
                rewardToken: await mockToken.getAddress(),
            },
        },
        defaultSender: deployer.address,
        config: {
            requiredConfirmations: 5,
        },
    });

    console.log(`Contract deployed to: ${await rd.getAddress()}`);

    const transferTx = await mockToken.transfer((await rd.getAddress()), parseUnits("1000", "ether"));
    await transferTx.wait();
    console.log("Contract's initial token balance", await mockToken.balanceOf(await rd.getAddress()))
}

async function main() {
    switch (hre.network.name) {
        case "localhost": {
            await localhost();
            break;
        }
        case "sepolia": {
            const safeAddr = process.env.SEPOLIA_SAFE_ADDRESS;
            if (!safeAddr) {
                console.log("safe address is not configured")
                return;
            }
            await sepolia(safeAddr);
            break;
        }
        default: {
            // const rewardToken = await hre.ethers.getContractAt("ERC20", );
            console.log(`deploy to '${hre.network.name}' network is not supported yet`);
        }
    }
}

main().catch(console.error)