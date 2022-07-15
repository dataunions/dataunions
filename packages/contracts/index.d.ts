import { providers, Signer } from "ethers";
import type { DataUnionTemplate, DataUnionFactory } from "./typechain";
export declare function dataUnionTemplateAt(address: string, signerOrProvider: providers.Provider | Signer): DataUnionTemplate;
export declare function deployDataUnionTemplate(signer: Signer): Promise<DataUnionTemplate>;
export declare function dataUnionFactoryAt(address: string, signerOrProvider: providers.Provider | Signer): DataUnionFactory;
export declare function deployDataUnionFactory(signer: Signer): Promise<DataUnionFactory>;
