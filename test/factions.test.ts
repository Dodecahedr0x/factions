import { expect } from "chai";
import { ethers } from "hardhat";
import { Signer } from "ethers";
import assertRevert from "./helpers/assertRevert";
import increaseTime from "./helpers/increaseTime";

const rarityAddress = "0xce761D788DF608BD21bdd59d6f4B54b2e27F25Bb";
const rarityAttributesAddress = "0xB5F5AF1087A8DA62A23b08C00C6ec9af21F397a1";
const raritySkillsAddress = "0x6292f3fB422e393342f257857e744d43b1Ae7e70";
const codexSkillsAddress = "0x67ae39a2Ee91D7258a86CD901B17527e19E493B3";

describe("Factions", async function () {
  let accounts: Signer[];
  const faction1 = 1
  const faction2 = 2

  beforeEach(async function () {
    accounts = await ethers.getSigners();
  });

  it("Should update settings", async function () {
    const Factions = await ethers.getContractFactory("Factions");
    const rarity = await ethers.getContractAt("rarity", rarityAddress);

    const factions = await Factions.deploy();
    await factions.deployed();

    const oldTribute = await factions.TRIBUTE()
    await factions.setTribute(oldTribute.mul(2));
    expect(await factions.TRIBUTE()).to.equal(oldTribute.mul(2))
    await assertRevert(factions.connect(accounts[1]).setTribute())

    const oldClashDelay = await factions.CLASH_DELAY()
    await factions.setClashDelay(oldClashDelay.mul(2));
    expect(await factions.CLASH_DELAY()).to.equal(oldClashDelay.mul(2))
    await assertRevert(factions.connect(accounts[1]).setClashDelay())

    const oldFactionChangeDelay = await factions.FACTION_CHANGE_DELAY()
    await factions.setFactionChangeDelay(oldFactionChangeDelay.mul(2));
    expect(await factions.FACTION_CHANGE_DELAY()).to.equal(oldFactionChangeDelay.mul(2))
    await assertRevert(factions.connect(accounts[1]).setFactionChangeDelay())

    const newOwner = await accounts[1].getAddress()
    await factions.setOwner(newOwner);
    expect(await factions.owner()).to.equal(newOwner)
    await assertRevert(factions.setOwner())
  });

  it("Should enroll created summoners", async function () {
    const Factions = await ethers.getContractFactory("Factions");
    const rarity = await ethers.getContractAt("rarity", rarityAddress);

    const attributes = await ethers.getContractAt(
      "rarity_attributes",
      rarityAttributesAddress
    );
    const factions = await Factions.deploy();
    await factions.deployed();

    // Summon a barbarian
    const result = await (await rarity.summon(1)).wait();
    const summoner = ethers.BigNumber.from(result.events[0].topics[3]);

    await assertRevert(factions.enroll(summoner, faction1));

    await attributes.point_buy(summoner, 17, 12, 17, 8, 8, 10);

    await factions.enroll(summoner, faction1);
  });

  it("Should take ready summoners from the player", async function () {
    const Factions = await ethers.getContractFactory("Factions");
    const rarity = await ethers.getContractAt("rarity", rarityAddress);

    const attributes = await ethers.getContractAt(
      "rarity_attributes",
      rarityAttributesAddress
    );
    const skills = await ethers.getContractAt(
      "rarity_skills",
      raritySkillsAddress
    );
    const factions = await Factions.deploy();
    await factions.deployed();

    const TRIBUTE = await factions.TRIBUTE();

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

    await rarity.setApprovalForAll(factions.address, true);

    await factions.readyOneSummoner(summoner1, { value: TRIBUTE });
    expect(await rarity.ownerOf(summoner1)).to.equal(factions.address);
    expect(await rarity.balanceOf(ownerAddress)).to.equal(initialBalance - 1);

    await factions.retrieveOneSummoner(summoner1);
    expect(await rarity.ownerOf(summoner1)).to.equal(ownerAddress);
    expect(await rarity.balanceOf(ownerAddress)).to.equal(initialBalance);

    await factions.readyManySummoners([summoner1, summoner2], {
      value: TRIBUTE.mul(2),
    });
    expect(await rarity.ownerOf(summoner1)).to.equal(factions.address);
    expect(await rarity.ownerOf(summoner2)).to.equal(factions.address);
    expect(await rarity.balanceOf(ownerAddress)).to.equal(initialBalance - 2);

    await factions.retrieveManySummoners([summoner1, summoner2]);
    expect(await rarity.ownerOf(summoner1)).to.equal(ownerAddress);
    expect(await rarity.ownerOf(summoner2)).to.equal(ownerAddress);
    expect(await rarity.balanceOf(ownerAddress)).to.equal(initialBalance);
  });

  it("Should list summoners sent by the player", async function () {
    const Factions = await ethers.getContractFactory("Factions");
    const rarity = await ethers.getContractAt("rarity", rarityAddress);

    const attributes = await ethers.getContractAt(
      "rarity_attributes",
      rarityAttributesAddress
    );
    const skills = await ethers.getContractAt(
      "rarity_skills",
      raritySkillsAddress
    );
    const factions = await Factions.deploy();
    await factions.deployed();

    const TRIBUTE = await factions.TRIBUTE();

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

    await rarity.setApprovalForAll(factions.address, true);

    await factions.readyManySummoners(summoners, { value: TRIBUTE.mul(summoners.length) });

    const toFetch = (await factions.getOwnedSummoners(ownerAddress)).toNumber()
    expect(toFetch).to.equal(summoners.length);
    for(let i = 0; i < toFetch; i++) {
      expect(await factions.getOwnedSummonerAtIndex(ownerAddress, i)).to.equal(summoners[i])
    }
  });

  it("Should let summoners earn from their won clash", async function () {
    const Factions = await ethers.getContractFactory("Factions");
    const rarity = await ethers.getContractAt("rarity", rarityAddress);

    const attributes = await ethers.getContractAt(
      "rarity_attributes",
      rarityAttributesAddress
    );
    const skills = await ethers.getContractAt(
      "rarity_skills",
      raritySkillsAddress
    );
    const factions = await Factions.deploy();
    await factions.deployed();

    const TRIBUTE = await factions.TRIBUTE();

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

    await rarity.setApprovalForAll(factions.address, true);

    await factions.readyManySummoners([summoner1, summoner2], {
      value: TRIBUTE.mul(2),
    });

    await factions.startClash();

    const balanceBefore1 = await (
      await ethers.getSigner(factions.address)
    ).getBalance();
    await factions.receiveOneTributeShare(summoner1);
    expect(
      await (await ethers.getSigner(factions.address)).getBalance()
    ).to.equal(balanceBefore1.sub(TRIBUTE.mul(2)));

    await assertRevert(factions.startClash()); // Too early

    await increaseTime(60 * 60 * 24);

    await factions.retrieveManySummoners([summoner1, summoner2]);
    await factions.readyManySummoners([summoner1, summoner2], {
      value: TRIBUTE.mul(2),
    });
    await factions.retrieveOneSummoner(summoner1); // Make sure faction 1 wins

    await factions.startClash();

    const balanceBefore2 = await (
      await ethers.getSigner(factions.address)
    ).getBalance();
    await factions.receiveOneTributeShare(summoner2);
    expect(
      await (await ethers.getSigner(factions.address)).getBalance()
    ).to.equal(balanceBefore2.sub(TRIBUTE.mul(2)));
  });

  it("Should split tribute between members of the winning faction", async function () {
    const Factions = await ethers.getContractFactory("Factions");
    const rarity = await ethers.getContractAt("rarity", rarityAddress);

    const attributes = await ethers.getContractAt(
      "rarity_attributes",
      rarityAttributesAddress
    );
    const skills = await ethers.getContractAt(
      "rarity_skills",
      raritySkillsAddress
    );
    const factions = await Factions.deploy();
    await factions.deployed();

    const TRIBUTE = await factions.TRIBUTE();

    let summoners = [];
    const membersPerFaction = 2;
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

    await rarity.setApprovalForAll(factions.address, true);

    await factions.readyManySummoners(summoners, {
      value: TRIBUTE.mul(summoners.length),
    });

    await factions.startClash();

    const tributesPaid = 5 * membersPerFaction;

    const balanceBefore1 = await (
      await ethers.getSigner(factions.address)
    ).getBalance();
    await factions.receiveOneTributeShare(summoners[0]);
    expect(
      await (await ethers.getSigner(factions.address)).getBalance()
    ).to.equal(
      balanceBefore1.sub(TRIBUTE.mul(tributesPaid / membersPerFaction))
    );
  });
});
