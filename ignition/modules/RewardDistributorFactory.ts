import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default  buildModule("RewardDistributorFactoryModule", (m) => {
    const factory = m.contract("RewardDistributorFactory",
        [m.getParameter("owner"), m.getParameter("imp")]);
    return {factory};
});
