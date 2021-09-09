import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments } = hre;
  const { deploy } = deployments;
  const accounts = await hre.getUnnamedAccounts();

  console.log("Available accounts:", accounts);

  console.log("Deploying to", hre.network.name, "from", accounts[0]);

  const deployedCore = await deploy("Factions", {
    from: accounts[0],
    args: [],
    log: true,
  });
};
export default deploy;
deploy.tags = ["Factions"];
