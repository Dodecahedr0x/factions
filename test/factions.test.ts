import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import assertRevert from "./helpers/assertRevert";

const rarityAddress = "0xce761D788DF608BD21bdd59d6f4B54b2e27F25Bb";
const attributesAddress = "0xB5F5AF1087A8DA62A23b08C00C6ec9af21F397a1";
const raritySkillsAddress = "0x6292f3fB422e393342f257857e744d43b1Ae7e70";
const codexSkillsAddress = "0x67ae39a2Ee91D7258a86CD901B17527e19E493B3";

describe("Factions", async function () {
  let accounts: Signer[];

  beforeEach(async function () {
    accounts = await ethers.getSigners();
  });

  it("Should enroll created summoners", async function () {
    const Factions = await ethers.getContractFactory("Factions");
    const rarity = await ethers.getContractAt("rarity", rarityAddress);
    
    const attributes = await ethers.getContractAt("attributes", attributesAddress)
    const factions = await Factions.deploy();
    await factions.deployed();

    // Summon a barbarian
    const result = await (await rarity.summon(1)).wait();
    const summoner = ethers.BigNumber.from(result.events[0].topics[3])

    await assertRevert(factions.enroll(summoner, 0));

    await attributes.point_buy(summoner, 17, 12, 17, 8, 8, 10);

    await factions.enroll(summoner, 0);
  });
});
