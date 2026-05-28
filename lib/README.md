Shared libraries to contain logic that is re-used between packages/.

These modules should never depend on anything outside of the lib/ folder.

Take care that potential private IP exists within a library. Be sure to not accidentally distribute private IP within a public package.
