package com.routy.sync.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val ManropeFamily = FontFamily.SansSerif
private val InterFamily = FontFamily.SansSerif

private val LightColors = lightColorScheme(
  primary = Color(0xFF6D3CD7),
  onPrimary = Color(0xFFFDF7FF),
  primaryContainer = Color(0xFF8152EC),
  onPrimaryContainer = Color(0xFFFFFFFF),
  secondary = Color(0xFF6053A6),
  onSecondary = Color(0xFFFCF7FF),
  secondaryContainer = Color(0xFFE6DEFF),
  onSecondaryContainer = Color(0xFF534597),
  tertiary = Color(0xFF615B7C),
  onTertiary = Color(0xFFFCF7FF),
  tertiaryContainer = Color(0xFFDED5FD),
  onTertiaryContainer = Color(0xFF4E4869),
  error = Color(0xFFA8364B),
  onError = Color(0xFFFFF7F7),
  errorContainer = Color(0xFFF97386),
  onErrorContainer = Color(0xFF6E0523),
  background = Color(0xFFFAF9FC),
  onBackground = Color(0xFF2F3337),
  surface = Color(0xFFFAF9FC),
  onSurface = Color(0xFF2F3337),
  surfaceVariant = Color(0xFFE0E2E8),
  onSurfaceVariant = Color(0xFF5C5F64),
  surfaceTint = Color(0xFF6D3CD7),
  outline = Color(0xFF787B80),
  outlineVariant = Color(0xFFB0B2B8),
  inverseSurface = Color(0xFF0D0E10),
  inverseOnSurface = Color(0xFF9C9D9F),
  inversePrimary = Color(0xFF9F78FF),
  surfaceDim = Color(0xFFD8DAE0),
  surfaceBright = Color(0xFFFAF9FC),
  surfaceContainerLowest = Color(0xFFFFFFFF),
  surfaceContainerLow = Color(0xFFF3F3F7),
  surfaceContainer = Color(0xFFEDEEF2),
  surfaceContainerHigh = Color(0xFFE7E8ED),
  surfaceContainerHighest = Color(0xFFE0E2E8)
)

private val DarkColors = darkColorScheme(
  primary = Color(0xFF9F78FF),
  onPrimary = Color(0xFF1E0F42),
  primaryContainer = Color(0xFF6D3CD7),
  onPrimaryContainer = Color(0xFFFFFFFF),
  secondary = Color(0xFFD7CEFF),
  onSecondary = Color(0xFF2D2555),
  secondaryContainer = Color(0xFF403284),
  onSecondaryContainer = Color(0xFFF1ECFF),
  tertiary = Color(0xFFD0C7EE),
  onTertiary = Color(0xFF2D2940),
  tertiaryContainer = Color(0xFF585273),
  onTertiaryContainer = Color(0xFFF0EBFF),
  error = Color(0xFFF97386),
  onError = Color(0xFF4A1020),
  errorContainer = Color(0xFF6B0221),
  onErrorContainer = Color(0xFFFFD8DF),
  background = Color(0xFF111218),
  onBackground = Color(0xFFF1F1F4),
  surface = Color(0xFF111218),
  onSurface = Color(0xFFF1F1F4),
  surfaceVariant = Color(0xFF2A2C33),
  onSurfaceVariant = Color(0xFFC3C5CC),
  surfaceTint = Color(0xFF9F78FF),
  outline = Color(0xFF8D9096),
  outlineVariant = Color(0xFF4B4E56),
  inverseSurface = Color(0xFFF3F3F7),
  inverseOnSurface = Color(0xFF202228),
  inversePrimary = Color(0xFF6D3CD7),
  surfaceDim = Color(0xFF0D0E10),
  surfaceBright = Color(0xFF33363D),
  surfaceContainerLowest = Color(0xFF0D0E10),
  surfaceContainerLow = Color(0xFF17181F),
  surfaceContainer = Color(0xFF1B1D24),
  surfaceContainerHigh = Color(0xFF262830),
  surfaceContainerHighest = Color(0xFF31333B)
)

private val SyncTypography = Typography(
  displayLarge = TextStyle(fontFamily = ManropeFamily, fontSize = 56.sp, lineHeight = 60.sp),
  displayMedium = TextStyle(fontFamily = ManropeFamily, fontSize = 44.sp, lineHeight = 48.sp),
  headlineLarge = TextStyle(fontFamily = ManropeFamily, fontSize = 34.sp, lineHeight = 38.sp),
  headlineMedium = TextStyle(fontFamily = ManropeFamily, fontSize = 30.sp, lineHeight = 34.sp),
  headlineSmall = TextStyle(fontFamily = ManropeFamily, fontSize = 24.sp, lineHeight = 28.sp),
  titleLarge = TextStyle(fontFamily = ManropeFamily, fontSize = 20.sp, lineHeight = 24.sp),
  titleMedium = TextStyle(fontFamily = InterFamily, fontSize = 16.sp, lineHeight = 20.sp),
  titleSmall = TextStyle(fontFamily = InterFamily, fontSize = 14.sp, lineHeight = 18.sp),
  bodyLarge = TextStyle(fontFamily = InterFamily, fontSize = 16.sp, lineHeight = 22.sp),
  bodyMedium = TextStyle(fontFamily = InterFamily, fontSize = 14.sp, lineHeight = 20.sp),
  bodySmall = TextStyle(fontFamily = InterFamily, fontSize = 12.sp, lineHeight = 18.sp),
  labelLarge = TextStyle(fontFamily = InterFamily, fontSize = 14.sp, lineHeight = 18.sp),
  labelMedium = TextStyle(fontFamily = InterFamily, fontSize = 12.sp, lineHeight = 16.sp),
  labelSmall = TextStyle(fontFamily = InterFamily, fontSize = 10.sp, lineHeight = 14.sp)
)

private val SyncShapes = Shapes(
  small = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
  medium = androidx.compose.foundation.shape.RoundedCornerShape(24.dp),
  large = androidx.compose.foundation.shape.RoundedCornerShape(32.dp),
  extraLarge = androidx.compose.foundation.shape.RoundedCornerShape(40.dp)
)

@Composable
fun RoutySyncTheme(content: @Composable () -> Unit) {
  MaterialTheme(
    colorScheme = if (isSystemInDarkTheme()) DarkColors else LightColors,
    typography = SyncTypography,
    shapes = SyncShapes,
    content = content
  )
}
