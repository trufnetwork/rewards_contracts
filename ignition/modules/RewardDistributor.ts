import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const RewardDistributorModule = buildModule("RewardDistributorModule", (m) => {
    const rewardToken = m.getParameter("rewardToken", "0x1dc4c1cefef38a777b15aa20260a54e584b16c48");

    const rd = m.contract("RewardDistributor",
        [["0x6Ecbe1DB9EF729CBe972C83Fb886247691Fb6beb",
            "0xE36Ea790bc9d7AB70C55260C66D52b1eca985f84",
            "0xE834EC434DABA538cd1b9Fe1582052B880BD7e63"],
         2,
            4000,
            rewardToken,
        ]
    );

    return {rd};
});

export default RewardDistributorModule;
