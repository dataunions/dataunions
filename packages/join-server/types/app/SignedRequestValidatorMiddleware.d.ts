declare function _exports(toleranceMillis?: number): {
    validator: (req: any) => Promise<void>;
    InvalidSignatureError: typeof InvalidSignatureError;
    InvalidTimestampError: typeof InvalidTimestampError;
};
export = _exports;
declare class InvalidSignatureError extends Error {
}
declare class InvalidTimestampError extends Error {
}
