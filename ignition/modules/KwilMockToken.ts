import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("KwilMockTokenModule", (m) => {
    const deployer = m.getAccount(1);
    const mockToken = m.contract("KwilMockToken",
        [m.getParameter("owner", deployer)], // if 'owner' not given, use deployer
        {from: deployer});
    return {mockToken};
});
