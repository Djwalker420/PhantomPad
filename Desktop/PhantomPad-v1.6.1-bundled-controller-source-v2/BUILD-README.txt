PhantomPad 1.6.1 source package

Android: Open android-app in Android Studio. Gradle syncs the shared controller folder into the APK. Then build an APK from the Build menu.
Windows: Run npm ci at the package root, then npm run start:pc or npm run build:pc. ViGEm prerequisites apply.

Android loads its controller interface from packaged assets and connects to the Windows app for inputs and the existing status, latency, player assignment, and vibration events. Layout preferences remain local on each phone.

Source only: no APK or Windows installer was built. No device testing has been performed.
