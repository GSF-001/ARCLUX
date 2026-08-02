// Deliberately circular with cyclic_b — Go's real compiler rejects import
// cycles, so this file is syntactically parseable but not meant to compile.
// Kept for detector testing once a Go parser exists.
package main

func HelperA() string {
	return HelperB()
}
