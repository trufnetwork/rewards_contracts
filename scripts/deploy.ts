import hre from "hardhat";
import RewardDistributorModule from "../ignition/modules/RewardDistributor";
import KwilMockToken from "../ignition/modules/KwilMockToken";
import { IERC20 } from "../typechain-types";

import "ethers";


async function main() {
    if (hre.network.name == "localhost") {
        const [networkOwner, signer1, signer2, signer3, newSigner4, rewardPoster, user1, user2, user3, rewardClaimer, unknownSigner] = await hre.ethers.getSigners();

        // let mockToken: IERC20;

        const {mockToken} = await hre.ignition.deploy(KwilMockToken, {
            defaultSender: networkOwner.address,
            parameters: {
                KwilMockToken: {
                    owner: networkOwner.address,
                }
            }
        });
        console.log(`Token deployed to: ${await mockToken.getAddress()}`);



        //
        //
        // //
        // // // Fetch the deployed contract
        // const TokenContract = await hre.ethers.getContractFactory("KwilMockToken");
        //
        //
        // const tokenContract = TokenContract.attach(await mockToken.getAddress());
        // //
        // // const transferTx = await tokenContract.connect(networkOwner).transfer(receiver, amount);
        //
        // // await mockToken.transfer((await rewardDist.getAddress()), parseUnits("1000", "ether"));


        const { rd, m } = await hre.ignition.deploy(RewardDistributorModule, {
            parameters: {
                RewardDistributor: {
                    signers: [signer1.address, signer2.address, signer3.address],
                    threshold: 2,
                    posterFee: "400000000000000",
                    rewardToken: await mockToken.getAddress(),
                },
            },
            defaultSender: networkOwner.address,
        });

        console.log(`Contract deployed to: ${await rd.getAddress()}`);


        // TODO: transfer some mockToken to rd

    } else {
        console.log(`deploy to '${hre.network.name}' network is not supported yet`);
    }
}

main().catch(console.error)