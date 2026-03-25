!ifdef APP_PACKAGE_URL
  !ifdef APP_ARM64_NAME
    # electron-builder's nsis-web template assumes x64/x86 names exist and
    # only branches into the ARM64 path when both are defined. For an ARM64-only
    # web installer, alias the missing names to the ARM64 payload so makensis
    # generates a working installer instead of failing on APP_32_NAME.
    !ifndef APP_64_NAME
      !define APP_64_NAME "${APP_ARM64_NAME}"
      !define APP_64_HASH "${APP_ARM64_HASH}"
      !define APP_64_UNPACKED_SIZE "${APP_ARM64_UNPACKED_SIZE}"
    !endif

    !ifndef APP_32_NAME
      !define APP_32_NAME "${APP_ARM64_NAME}"
      !define APP_32_HASH "${APP_ARM64_HASH}"
      !define APP_32_UNPACKED_SIZE "${APP_ARM64_UNPACKED_SIZE}"
    !endif
  !endif
!endif
