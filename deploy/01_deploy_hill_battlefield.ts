import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy, get } = deployments;
  const accounts = await hre.getUnnamedAccounts();

  console.log("Deploying Hill Battlefield");

  const deployedFactions = await get("Factions");

  await deploy("HillBattlefield", {
    from: accounts[0],
    args: [deployedFactions.address],
    log: true,
  });
};
export default deploy;
deploy.tags = ["hill", "battlefield"];
