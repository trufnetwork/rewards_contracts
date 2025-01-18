import Safe from "@safe-global/protocol-kit";
import hre from "hardhat";
import {GenHDWallets} from "../wallet";
import {expect} from "chai";
import {RewardSafe} from "../gnosis";


/*
    This is a reference for Golang implementation.
    Golang impl should use the same parameter as used in this test.
 */
describe("Crypto", function () {
    if (hre.network.name != "sepolia") {
        console.log("Skip test on network: " + hre.network.name);
        return;
    }

    const mnemonic = "test test test test test test test test test test test junk" // default hardhat mnemonic
    const alchemyApiKey = process.env.ALCHEMY_API_KEY;
    const rpcURL = `https://eth-sepolia.g.alchemy.com/v2/${alchemyApiKey}`;
    const chainID = 11155111n;

    const safeAddress = "0xbBeaaA74777B1dc14935f5b7E96Bb0ed6DBbD596";
    const rewardAddress= "0x55EAC662C9D77cb537DBc9A57C0aDa90eB88132d";
    const [ceo, cfo, eng, poster] = GenHDWallets(mnemonic);

    it("Only sign safe tx hash", async () => {
        console.log("safe address: ", safeAddress);
        console.log("reward address: ", rewardAddress);
        console.log("ceo address: ", ceo.address);
        const safeSigner = await Safe.init({
            provider: rpcURL,
            safeAddress: safeAddress,
            signer: ceo.privateKey
        })

        // const {safeTxHash} = await this.genPostRewardSafeTx(root, amount);
        const safeTxHash: string = "0x9572f8c1c5682c56eebc035e5e20d686c62354bf612400d32daf955766915293"
        const safeSignature = await safeSigner.signHash(safeTxHash)

        // expect(safeTxHash).to.equal("0x52f216cb6f82f6b5d80d5d0e822d759908fdd5b180ceda094cd93b6fe6da1bb7");
        expect(safeSignature.signer).to.equal("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
        expect(safeSignature.data).to.equal("0x8e7091f38dff5127c08580adaa07ab0b3ab5326beaca194f8703da1a31efdf735a4bddb505ec92ee52714a5591db71c9af57c5144458c5cc56098054e26ad44f1f");
    })

    it("Generate safe tx hash", async () => {
        const root = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        const amount = 21;
        const nonce = 10;
        const expectedSafeTxHash = "0x8a4bdbe18b63f4be41193afabd32aab90547da08f5c477123284f961a1f66383"
        const expectedSig = "0x05da477a982879422f291a445a1c4ff39bb43cfba4b1cacc3d5b157c254005112d61ff13e49e17f88557e59179e7b91b0adb09c202e3c156bbdedbfd0d6085fb1f"

        const gSafe = new RewardSafe(rpcURL, chainID, safeAddress, rewardAddress, "");

        const {safeTxHash, signature} = await gSafe.signPostReward(root, amount, ceo.privateKey, nonce);

        expect(safeTxHash).to.equal(expectedSafeTxHash);
        expect(signature).to.equal(expectedSig);
    })
})