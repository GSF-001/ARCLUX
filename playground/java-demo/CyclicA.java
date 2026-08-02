// Deliberately circular with CyclicB — kept for detector testing once a
// Java parser exists. Java tolerates class-level circular references at
// compile time (unlike Go), so this one is actually valid Java.
package demo;

public class CyclicA {
    public static String helperA() {
        return CyclicB.helperB();
    }
}
