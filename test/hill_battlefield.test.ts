import { expect } from "chai";
import { ethers } from "hardhat";
import { ContractFactory, Contract, Signer, BigNumber } from "ethers";
import assertRevert from "./helpers/assertRevert";
import increaseTime from "./helpers/increaseTime";

const rarityAddress = "0xce761D788DF608BD21bdd59d6f4B54b2e27F25Bb";
const rarityAttributesAddress = "0xB5F5AF1087A8DA62A23b08C00C6ec9af21F397a1";
const raritySkillsAddress = "0x6292f3fB422e393342f257857e744d43b1Ae7e70";
const codexSkillsAddress = "0x67ae39a2Ee91D7258a86CD901B17527e19E493B3";

describe("HillBattlefield", async function () {
  let Factions: ContractFactory, HillBattlefield: ContractFactory;
  let factions: Contract,
    battlefield: Contract,
    rarity: Contract,
    attributes: Contract,
    skills: Contract;
  let tribute: BigNumber;
  let accounts: Signer[];
  const faction1 = 1;
  const faction2 = 2;

  beforeEach(async function () {
    Factions = await ethers.getContractFactory("Factions");
    HillBattlefield = await ethers.getContractFactory("HillBattlefield");

    accounts = await ethers.getSigners();

    rarity = await ethers.getContractAt("IRarity", rarityAddress);
    attributes = await ethers.getContractAt(
      "IRarityAttributes",
      rarityAttributesAddress
    );
    skills = await ethers.getContractAt("IRaritySkills", raritySkillsAddress);

    factions = await Factions.deploy();
    await factions.deployed();
    battlefield = await HillBattlefield.deploy(factions.address);

    tribute = await battlefield.tribute();
  });

  it("Should update settings", async function () {
    const oldTribute = await battlefield.tribute();
    await battlefield.setTribute(oldTribute.mul(2));
    expect(await battlefield.tribute()).to.equal(oldTribute.mul(2));
    await assertRevert(battlefield.connect(accounts[1]).setTribute());

    const oldClashDelay = await battlefield.clashDelay();
    await battlefield.setClashDelay(oldClashDelay.mul(2));
    expect(await battlefield.clashDelay()).to.equal(oldClashDelay.mul(2));
    await assertRevert(battlefield.connect(accounts[1]).setClashDelay());

    const newOwner = await accounts[1].getAddress();
    await battlefield.setOwner(newOwner);
    expect(await battlefield.owner()).to.equal(newOwner);
    await assertRevert(battlefield.setOwner());
  });

  it("Should take ready summoners from the player", async function () {
    let result = await (await rarity.summon(1)).wait();
    const summoner1 = ethers.BigNumber.from(result.events[0].topics[3]);
    await attributes.point_buy(summoner1, 17, 12, 17, 8, 8, 10);
    await factions.enroll(summoner1, faction1);
    const skills1 = [
      0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    await skills.set_skills(summoner1, skills1);

    const powerIncrease = await battlefield.powerIncrease(summoner1);
    expect(powerIncrease.toNumber()).to.equal(51);

    result = await (await rarity.summon(2)).wait();
    const summoner2 = ethers.BigNumber.from(result.events[0].topics[3]);
    await attributes.point_buy(summoner2, 17, 12, 17, 8, 10, 8);
    await factions.enroll(summoner2, faction2);
    const skills2 = [
      3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    await skills.set_skills(summoner2, skills2);

    const initialBalance = (
      await rarity.balanceOf(accounts[0].getAddress())
    ).toNumber();
    const ownerAddress = await accounts[0].getAddress();

    await rarity.setApprovalForAll(battlefield.address, true);

    await battlefield.readyOneSummoner(summoner1, { value: tribute });
    expect(await rarity.ownerOf(summoner1)).to.equal(battlefield.address);
    expect(await rarity.balanceOf(ownerAddress)).to.equal(initialBalance - 1);
    expect(await battlefield.treasury(faction1)).to.equal(tribute);
    expect(await battlefield.factionPower(faction1)).to.equal(powerIncrease);

    await battlefield.retrieveOneSummoner(summoner1);
    expect(await rarity.ownerOf(summoner1)).to.equal(ownerAddress);
    expect(await rarity.balanceOf(ownerAddress)).to.equal(initialBalance);
    expect(await battlefield.treasury(faction1)).to.equal(tribute);

    await battlefield.readyManySummoners([summoner1, summoner2], {
      value: tribute.mul(2),
    });
    expect(await rarity.ownerOf(summoner1)).to.equal(battlefield.address);
    expect(await rarity.ownerOf(summoner2)).to.equal(battlefield.address);
    expect(await rarity.balanceOf(ownerAddress)).to.equal(initialBalance - 2);
    expect(await battlefield.treasury(faction1)).to.equal(tribute.mul(2));
    expect(await battlefield.treasury(faction2)).to.equal(tribute);

    await battlefield.retrieveManySummoners([summoner1, summoner2]);
    expect(await rarity.ownerOf(summoner1)).to.equal(ownerAddress);
    expect(await rarity.ownerOf(summoner2)).to.equal(ownerAddress);
    expect(await rarity.balanceOf(ownerAddress)).to.equal(initialBalance);
    expect(await battlefield.treasury(faction1)).to.equal(tribute.mul(2));
    expect(await battlefield.treasury(faction2)).to.equal(tribute);
  });

  it("Should list summoners sent by the player", async function () {
    const mintedSummoner = 10;
    let summoners: number[] = [];
    for (let i = 0; i < mintedSummoner; i++) {
      let result = await (await rarity.summon(1)).wait();
      const summoner = ethers.BigNumber.from(result.events[0].topics[3]);
      await attributes.point_buy(summoner, 17, 12, 17, 8, 8, 10);
      await factions.enroll(summoner, faction1);
      const skills1 = [
        0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ];
      await skills.set_skills(summoner, skills1);
      summoners.push(summoner.toNumber());
    }

    const ownerAddress = await accounts[0].getAddress();

    await rarity.setApprovalForAll(battlefield.address, true);

    await battlefield.readyManySummoners(summoners, {
      value: tribute.mul(summoners.length),
    });

    const toFetch = (
      await battlefield.getOwnedSummoners(ownerAddress)
    ).toNumber();
    expect(toFetch).to.equal(summoners.length);

    for (let i = 0; i < toFetch; i++) {
      const summoner = await battlefield.getOwnedSummonerAtIndex(
        ownerAddress,
        i
      );
      expect(summoner).to.equal(summoners[i]);
    }
  });

  it("Should let summoners earn from their won clash", async function () {
    let result = await (await rarity.summon(1)).wait();
    const summoner1 = ethers.BigNumber.from(result.events[0].topics[3]);
    await attributes.point_buy(summoner1, 17, 12, 17, 8, 8, 10);
    await factions.enroll(summoner1, faction1);
    const skills1 = [
      0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    await skills.set_skills(summoner1, skills1);

    result = await (await rarity.summon(2)).wait();
    const summoner2 = ethers.BigNumber.from(result.events[0].topics[3]);
    await attributes.point_buy(summoner2, 17, 12, 17, 10, 8, 8);
    await factions.enroll(summoner2, faction2);
    const skills2 = [
      3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ];
    await skills.set_skills(summoner2, skills2);

    await rarity.setApprovalForAll(battlefield.address, true);

    const initialBalance = await (
      await ethers.getSigner(battlefield.address)
    ).getBalance();

    await battlefield.readyManySummoners([summoner1, summoner2], {
      value: tribute.mul(2),
    });
    const balanceAfterReady = await (
      await ethers.getSigner(battlefield.address)
    ).getBalance();
    expect(balanceAfterReady).to.equal(initialBalance.add(tribute.mul(2)));
    expect(await battlefield.treasury(faction1)).to.equal(tribute);
    expect(await battlefield.treasury(faction2)).to.equal(tribute);

    const collectableBefore = await battlefield.availableToCollect(summoner1);

    await battlefield.startClash();

    const collectable = await battlefield.availableToCollect(summoner1);
    expect(collectable).to.equal(collectableBefore.add(tribute.mul(2)));
    expect(await battlefield.treasury(faction1)).to.equal(tribute.mul(2));
    expect(await battlefield.treasury(faction2)).to.equal(tribute.mul(0));

    await battlefield.receiveOneTributeShare(summoner1);
    const balanceAfterCollect = await (
      await ethers.getSigner(battlefield.address)
    ).getBalance();
    expect(balanceAfterCollect).to.equal(balanceAfterReady.sub(collectable));

    await assertRevert(battlefield.startClash()); // Too early

    await increaseTime(60 * 60 * 24);

    await battlefield.retrieveManySummoners([summoner1, summoner2]);
    await battlefield.readyManySummoners([summoner1, summoner2], {
      value: tribute.mul(2),
    });
    await battlefield.retrieveOneSummoner(summoner1); // Make sure faction 2 wins

    await battlefield.startClash();
    expect(await battlefield.lastWinner()).to.equal(faction1);
    expect(await battlefield.treasury(faction1)).to.equal(tribute.mul(0));
    expect(await battlefield.treasury(faction2)).to.equal(tribute.mul(2));

    const balanceBefore2 = await (
      await ethers.getSigner(battlefield.address)
    ).getBalance();
    await battlefield.receiveOneTributeShare(summoner2);
    expect(
      await (await ethers.getSigner(battlefield.address)).getBalance()
    ).to.equal(balanceBefore2.sub(tribute.mul(2)));
  });

  it("Should split tribute between members of the winning faction", async function () {
    let summoners = [];
    const membersPerFaction = 3;
    // winning faction
    for (let i = 0; i < membersPerFaction; i++) {
      let result = await (await rarity.summon(1)).wait();
      const summoner = ethers.BigNumber.from(result.events[0].topics[3]);
      await attributes.point_buy(summoner, 17, 12, 17, 8, 8, 10);
      await factions.enroll(summoner, faction1);
      const skills1 = [
        0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      ];
      await skills.set_skills(summoner, skills1);
      summoners.push(summoner);
    }

    // losing factions
    for (let f = faction2; f <= 5; f++) {
      for (let i = 0; i < membersPerFaction; i++) {
        let result = await (await rarity.summon(2)).wait();
        const summoner = ethers.BigNumber.from(result.events[0].topics[3]);
        await attributes.point_buy(summoner, 17, 12, 17, 10, 8, 8);
        await factions.enroll(summoner, f);
        const skills2 = [
          3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ];
        await skills.set_skills(summoner, skills2);
        summoners.push(summoner);
      }
    }

    await rarity.setApprovalForAll(battlefield.address, true);

    await battlefield.readyManySummoners(summoners, {
      value: tribute.mul(summoners.length),
    });

    await battlefield.startClash();

    const tributesPaid = 5 * membersPerFaction;

    const balanceBefore1 = await (
      await ethers.getSigner(battlefield.address)
    ).getBalance();
    await battlefield.receiveOneTributeShare(summoners[0]);
    expect(
      await (await ethers.getSigner(battlefield.address)).getBalance()
    ).to.equal(
      balanceBefore1.sub(tribute.mul(tributesPaid / membersPerFaction))
    );

    const balanceBefore2 = await (
      await ethers.getSigner(battlefield.address)
    ).getBalance();
    await battlefield.receiveManyTributeShares([summoners[1], summoners[2]]);
    expect(
      await (await ethers.getSigner(battlefield.address)).getBalance()
    ).to.equal(
      balanceBefore2.sub(tribute.mul(tributesPaid / membersPerFaction).mul(2))
    );
  });
});
