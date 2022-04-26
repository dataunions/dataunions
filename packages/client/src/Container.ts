/**
 * DI Token for injecting the Client container.
 * Use sparingly, but can be necessary for factories
 * or to work around circular dependencies.
 */
export const DataUnionContainer = Symbol('DataUnionContainer')
