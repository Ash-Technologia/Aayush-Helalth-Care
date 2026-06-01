'use strict';

const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const asyncHandler = require('express-async-handler');

// NOTE: User model is required lazily inside the strategy callback
// to avoid circular dependency issues at module load time.

const initPassport = () => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL = process.env.GOOGLE_CALLBACK_URL;

  if (!clientID || !clientSecret || !callbackURL) {
    console.warn(
      '[Passport] Google OAuth env vars missing. Google login will be unavailable.'
    );
    return;
  }

  passport.use(
    new GoogleStrategy(
      { clientID, clientSecret, callbackURL },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Lazy require to avoid circular deps at startup
          const User = require('../models/User');

          const email =
            profile.emails && profile.emails[0]
              ? profile.emails[0].value.toLowerCase()
              : null;

          if (!email) {
            return done(new Error('Google account has no email address.'), null);
          }

          // Find existing user by googleId OR email
          let user = await User.findOne({
            $or: [{ googleId: profile.id }, { email }],
          });

          if (!user) {
            // Create new user from Google profile
            user = await User.create({
              fullName: profile.displayName,
              email,
              googleId: profile.id,
              avatar:
                profile.photos && profile.photos[0]
                  ? profile.photos[0].value
                  : null,
              isEmailVerified: true, // Google already verified the email
            });
          } else {
            // Link googleId if user found by email but has no googleId
            if (!user.googleId) {
              user.googleId = profile.id;
              if (!user.avatar && profile.photos && profile.photos[0]) {
                user.avatar = profile.photos[0].value;
              }
              if (!user.isEmailVerified) {
                user.isEmailVerified = true;
              }
              await user.save();
            }
          }

          if (!user.isActive) {
            return done(null, false, { message: 'Account is deactivated.' });
          }

          return done(null, user);
        } catch (err) {
          return done(err, null);
        }
      }
    )
  );

  // Passport serialize/deserialize (only needed for session-based flows)
  // We use JWT, so these are minimal stubs required by Passport internals.
  passport.serializeUser((user, done) => done(null, user._id));
  passport.deserializeUser(async (id, done) => {
    try {
      const User = require('../models/User');
      const user = await User.findById(id).select('-passwordHash -refreshTokens');
      done(null, user);
    } catch (err) {
      done(err, null);
    }
  });
};

module.exports = initPassport;
