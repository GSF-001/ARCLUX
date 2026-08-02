package demo;

public class Service {
    public static String createUserProfile(Models.User user) {
        return Utils.slugify(user.firstName + " " + user.lastName);
    }
}
