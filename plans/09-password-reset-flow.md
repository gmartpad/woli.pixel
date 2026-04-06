# 09 — Password Reset Flow

**Date:** 2026-04-04
**Status:** Approved

## Problem

The backend supports password reset via better-auth + Resend, but there's no frontend UI for it.

## Solution

Two new components inside the existing auth flow: ForgotPasswordPage (request reset email) and ResetPasswordPage (set new password from token). Integrated into AuthGuard's view state.

## Changes

- Create: `ForgotPasswordPage.tsx` — email input, calls `authClient.forgetPassword()`
- Create: `ResetPasswordPage.tsx` — new password + confirm, calls `authClient.resetPassword()`
- Modify: `LoginPage.tsx` — add "Esqueceu a senha?" link with `onForgot` prop
- Modify: `AuthGuard.tsx` — add "forgot"/"reset" views, check URL for `?token=`
