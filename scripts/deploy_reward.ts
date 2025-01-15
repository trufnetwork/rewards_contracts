import hre from "hardhat";
import RewardDistributorModule from "../ignition/modules/RewardDistributor";
import RewardDistributorSafeModule from "../ignition/modules/RewardDistributorSafe";
import KwilMockToken from "../ignition/modules/KwilMockToken";
import { parseUnits } from "ethers";

import dotenv from 'dotenv';
dotenv.config();


async function localhost() {
    const [networkOwner, signer1, signer2, signer3, newSigner4,
        rewardPoster, user1, user2, user3, rewardClaimer, unknownSigner] = await hre.ethers.getSigners();

    const {mockToken} = await hre.ignition.deploy(KwilMockToken, {
        defaultSender: networkOwner.address,
        parameters: {
            KwilMockToken: {
                owner: networkOwner.address,
            }
        },
        config: {
            requiredConfirmations: 1,
        },
    });

    console.log(`Token deployed to: ${await mockToken.getAddress()}`);

    const { rd } = await hre.ignition.deploy(RewardDistributorModule, {
        parameters: {
            RewardDistributor: {
                signers: [signer1.address, signer2.address, signer3.address],
                threshold: 2,
                posterFee: "400000000000000",
                rewardToken: await mockToken.getAddress(),
            },
        },
        defaultSender: networkOwner.address,
        config: {
            requiredConfirmations: 1,
        },
    });

    console.log(`Contract deployed to: ${await rd.getAddress()}`);

    await mockToken.transfer((await rd.getAddress()), parseUnits("1000", "ether"));
    console.log("Contract's token balance", await mockToken.balanceOf(await rd.getAddress()))
}

async function sepolia() {
    const [ceo, cto, eng, poster] = await hre.ethers.getSigners();
    const safeAddr = process.env.SEPOLIA_SAFE_ADDRESS;
    console.assert(safeAddr, "safe address is not configured")

    const {mockToken} = await hre.ignition.deploy(KwilMockToken, {
        defaultSender: ceo.address,
        parameters: {
            KwilMockToken: {
                owner: ceo.address,
            }
        },
        config: {
            requiredConfirmations: 5,
        },
    });

    console.log(`Token deployed to: ${await mockToken.getAddress()}`);

    const { rd } = await hre.ignition.deploy(RewardDistributorSafeModule, {
        parameters: {
            RewardDistributor: {
                safe: safeAddr!,
                posterFee: "400000000000000",
                rewardToken: await mockToken.getAddress(),
            },
        },
        defaultSender: ceo.address,
        config: {
            requiredConfirmations: 5,
        },
    });

    console.log(`Contract deployed to: ${await rd.getAddress()}`);

    const transferTx = await mockToken.transfer((await rd.getAddress()), parseUnits("1000", "ether"));
    await transferTx.wait();
    console.log("Contract's token balance", await mockToken.balanceOf(await rd.getAddress()))
}

async function main() {
    switch (hre.network.name) {
        case "localhost": {
            await localhost();
            break;
        }
        case "sepolia": {
            await sepolia();
            break;
        }
        default: {
            console.log(`deploy to '${hre.network.name}' network is not supported yet`);
        }
    }
}

main().catch(console.error)