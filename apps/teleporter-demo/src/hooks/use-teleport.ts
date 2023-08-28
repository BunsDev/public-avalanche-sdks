import { TELEPORTER_BRIDGE_ABI } from '@/constants/abis/teleporter-bridge-abi';
import { toast } from '@/ui/hooks/use-toast';
import {
  useAccount,
  useChainId,
  useContractWrite,
  usePrepareContractWrite,
  useSwitchNetwork,
  useContractRead,
} from 'wagmi';
import { useApprove } from './use-approve';
import { NATIVE_ERC20_ABI } from '@/constants/abis/native-erc-20';
import { isNil } from 'lodash-es';
import type { EvmChain } from '@/types/chain';

const TELEPORT_AMOUNT = BigInt('1000000000000000');

export const useTeleport = ({
  fromChain,
  toChain,
  amount,
}: {
  fromChain?: EvmChain;
  toChain?: EvmChain;
  amount?: bigint;
}) => {
  const chainId = String(useChainId());
  const { switchNetworkAsync } = useSwitchNetwork();
  const { address } = useAccount();

  const { data: currentAllowance } = useContractRead({
    address: fromChain?.utilityContracts.demoErc20.address,
    functionName: 'allowance',
    abi: NATIVE_ERC20_ABI,
    args: address && fromChain ? [address, fromChain?.utilityContracts.bridge.address] : undefined,
  });

  const { approve } = useApprove({
    chain: fromChain,
    amount,
    addressToApprove: fromChain?.utilityContracts.bridge.address,
    tokenAddress: fromChain?.utilityContracts.demoErc20.address,
  });

  const { config } = usePrepareContractWrite({
    address: fromChain?.utilityContracts.bridge.address,
    functionName: 'bridgeTokens',
    abi: TELEPORTER_BRIDGE_ABI,
    args:
      fromChain && toChain && address && amount
        ? [
            toChain?.platformChainIdHex,
            toChain?.utilityContracts.bridge.address,
            fromChain?.utilityContracts.demoErc20.address,
            address,
            amount,
            BigInt(0),
            BigInt(0),
          ]
        : undefined,
    maxFeePerGas: BigInt(0),
    maxPriorityFeePerGas: BigInt(0),
  });

  const { writeAsync } = useContractWrite(config);

  return {
    teleportToken: async () => {
      try {
        if (!switchNetworkAsync) {
          throw new Error('switchNetworkAsync is undefined.');
        }
        if (!fromChain) {
          throw new Error('Missing source subnet.');
        }
        if (!toChain) {
          throw new Error('Missing destination subnet.');
        }

        if (chainId !== fromChain.chainId) {
          const chainSwitchRes = await switchNetworkAsync(Number(fromChain.chainId));
          if (String(chainSwitchRes.id) !== fromChain.chainId) {
            throw new Error(`Must be connected to ${fromChain.name}.`);
          }
        }

        if (isNil(currentAllowance)) {
          throw new Error('Unable to detect current allowance.');
        }

        if (currentAllowance < TELEPORT_AMOUNT) {
          const approveResponse = await approve();
          console.log('Approve successful.', approveResponse);
        }

        if (!writeAsync) {
          throw new Error('writeAsync is undefined.');
        }

        const mintResponse = await writeAsync?.();
        console.info('Successfully minted token.', mintResponse);
        toast({
          title: 'Success',
          description: `Teleportation successful!`,
        });
        return mintResponse;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        console.warn(e?.message ?? e);

        toast({
          title: 'Error',
          description: `Teleportation failed.`,
        });

        return undefined;
      }
    },
  };
};