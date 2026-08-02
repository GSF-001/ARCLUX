package demo;

public class Utils {
    public static String slugify(String text) {
        return text.toLowerCase().replace(" ", "-");
    }

    // Never called anywhere — should be flagged by detectUnusedExports
    // once the Java parser exists.
    public static void unusedHelper() {}
}
