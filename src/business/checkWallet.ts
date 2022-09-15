import getWalletAddress from '../utils/getWalletAddress.js';
import { getWalletHoldings } from '../integration/xrpl/getWalletHoldings.js';
import { Message } from 'discord.js';
import EventWrapper from '../events/EventWrapper.js';
import { EventTypes } from '../events/EventTypes.js';

const checkWallet = async (message: Message) => {
  // Get address
  const walletAddress = getWalletAddress(message.content);

  if (!walletAddress) {
    // Message for this error is sent in getWalletAddress
    return;
  }

  // Get holdings
  const holdings = await getWalletHoldings(walletAddress, null);
  if (holdings === -1) {
    return message.reply(
      `Seems like the wallet doesn't have the project trustline, please verify the trustline is set and try again 👉 https://xrpscan.com/account/${walletAddress}`
    );
  }

  if (holdings === null) {
    return message.reply(
      `There was an issue getting the wallet holdings from XRPL network, please try later or use 👉 https://xrpscan.com/account/${walletAddress}`
    );
  }

  return message.reply(
    `The wallet has ${holdings} points 👉 https://xrpscan.com/account/${walletAddress}`
  );
};

const eventCallback = (eventWrapper: EventWrapper) => {
  const inputLower = eventWrapper.payload.content.toLowerCase();

  if (
    inputLower.includes('check wallet') ||
    inputLower.includes('checkwallet')
  ) {
    eventWrapper.handled = true;
    return checkWallet(eventWrapper.payload);
  }
};

export default class CheckWallet {
  public static setup(eventEmitter: any): void {
    eventEmitter.addListener(EventTypes.MESSAGE, eventCallback);
  }
}
