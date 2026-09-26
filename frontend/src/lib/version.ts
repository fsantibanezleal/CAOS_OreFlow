// The release version is the root VERSION file: the engine stamps it on every artifact and the service
// reports it, so the interface reads the same file at build time instead of carrying its own copy.
import version from '../../../VERSION?raw';

export const APP_VERSION = version.trim();
