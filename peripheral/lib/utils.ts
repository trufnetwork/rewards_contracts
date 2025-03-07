import { ethers } from "ethers";

// https://gist.github.com/gluk64/fdea559472d957f1138ed93bcbc6f78a?permalink_comment_id=4673094#gistcomment-4673094
async function getTxRevertMessage(provider: ethers.Provider, tx:ethers.TransactionResponse) {
    try {
        const response = await provider.call(
            {
                to: tx.to,
                from: tx.from,
                nonce: tx.nonce,
                gasLimit: tx.gasLimit,
                gasPrice: tx.gasPrice,
                data: tx.data,
                value: tx.value,
                chainId: tx.chainId,
                type: tx.type ?? undefined,
                accessList: tx.accessList,
                blockTag: tx.blockNumber!,
            }
        )
        return ethers.toUtf8String('0x' + response.substring(138))
    } catch (err:any) {
        if (err&&err.shortMessage) {
            return err.shortMessage
        }
        return err
    }
}

const zeroAddress = () => "0x0000000000000000000000000000000000000000";


export { getTxRevertMessage, zeroAddress }