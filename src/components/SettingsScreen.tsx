import React from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { Header } from './Brand';
import { BundleCard } from './BundleCard';
import { SecondaryButton, TextButton } from './Buttons';
import { Screen } from './Screen';
import { UpdateCard } from './UpdateCard';
import { Text } from '../ui/Text';
import { RoundButton } from '../ui/RoundButton';
import type { AppUpdate } from '../hooks/useAppUpdate';
import { useOtaUpdate } from '../hooks/useOtaUpdate';
import { useFlash } from '../hooks/useFlash';
import { usePrivacy } from '../hooks/usePrivacy';
import {
  PALETTE_OPTIONS,
  useTheme,
} from '../theme/ThemeProvider';
import type {
  FontId,
  ShapeId,
  SizeId,
  TextSizeId,
} from '../theme/ThemeProvider';
import { useThemedStyles, type AppTheme } from '../theme/ThemeProvider';
import { playPressFeedback } from '../lib/haptics';

const SHAPES: Array<{ id: ShapeId; label: string }> = [
  { id: 'sharp', label: 'Sharp' },
  { id: 'soft', label: 'Soft' },
  { id: 'round', label: 'Round' },
];

const SIZES: Array<{ id: SizeId; label: string }> = [
  { id: 'compact', label: 'Compact' },
  { id: 'standard', label: 'Standard' },
  { id: 'large', label: 'Large' },
];

const FONTS: Array<{ id: FontId; label: string; family?: string }> = [
  { id: 'system', label: 'System' },
  { id: 'condensed', label: 'Condensed', family: 'sans-serif-condensed' },
  { id: 'serif', label: 'Serif', family: 'serif' },
  { id: 'mono', label: 'Mono', family: 'monospace' },
];

const TEXT_SIZES: Array<{ id: TextSizeId; label: string }> = [
  { id: 'small', label: 'S' },
  { id: 'default', label: 'M' },
  { id: 'large', label: 'L' },
  { id: 'xlarge', label: 'XL' },
];

const RECOVERY_CODE = '*#*#4263#*#*';

function SectionTitle({ children }: { children: string }) {
  const { styles } = useThemedStyles(makeStyles);
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function ChoiceRow<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: Array<{ id: T; label: string; family?: string }>;
  value: T;
  onSelect: (id: T) => void;
}) {
  const { styles } = useThemedStyles(makeStyles);
  return (
    <View style={styles.choiceRow}>
      {options.map(option => {
        const active = option.id === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
            key={option.id}
            onPress={() => {
              playPressFeedback();
              onSelect(option.id);
            }}
            style={({ pressed }) => [
              styles.choice,
              active ? styles.choiceActive : null,
              pressed ? styles.choicePressed : null,
            ]}
          >
            <Text
              style={[
                styles.choiceLabel,
                option.family ? { fontFamily: option.family } : null,
                active ? styles.choiceLabelActive : null,
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SettingSwitch({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const { styles, colors } = useThemedStyles(makeStyles);
  return (
    <View style={styles.switchRow}>
      <View style={styles.switchCopy}>
        <Text style={styles.switchLabel}>{label}</Text>
        <Text style={styles.switchDescription}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        disabled={disabled}
        onValueChange={onValueChange}
        thumbColor={value ? colors.accent : colors.textMuted}
        trackColor={{ false: colors.lineStrong, true: colors.accentLine }}
        value={value}
      />
    </View>
  );
}

export function SettingsScreen({
  onBack,
  onOpenHaptics,
  update,
}: {
  onBack: () => void;
  onOpenHaptics: () => void;
  update: AppUpdate;
}) {
  const { settings, updateSettings, resetSettings } = useTheme();
  const { styles: localStyles, colors } = useThemedStyles(makeStyles);
  const privacy = usePrivacy();
  const flash = useFlash();
  const bundle = useOtaUpdate(update.installed);

  return (
    <Screen>
      <Header
        right={
          <RoundButton
            accessibilityLabel="Back"
            kind="back"
            onPress={onBack}
          />
        }
      />

      <View style={localStyles.hero}>
        <Text style={localStyles.eyebrow}>SETTINGS</Text>
        <Text style={localStyles.title}>Make it yours.</Text>
        <Text style={localStyles.body}>
          Every choice applies instantly across the app, then stays saved on this
          phone.
        </Text>
      </View>

      <View style={localStyles.previewCard}>
        <Text style={localStyles.previewEyebrow}>LIVE PREVIEW</Text>
        <Text style={localStyles.previewTitle}>A quiet tap.</Text>
        <Text style={localStyles.previewBody}>
          {settings.palette.toUpperCase()} · {settings.shape.toUpperCase()} ·{' '}
          {settings.size.toUpperCase()} · {settings.font.toUpperCase()} ·{' '}
          {settings.textSize.toUpperCase()}
        </Text>
      </View>

      <View style={localStyles.section}>
        <SectionTitle>COLOUR THEME</SectionTitle>
        <View style={localStyles.card}>
          <View style={localStyles.paletteRow}>
            {PALETTE_OPTIONS.map(option => {
              const active = option.id === settings.palette;
              return (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${option.label} theme`}
                  key={option.id}
                  onPress={() => {
                    playPressFeedback();
                    updateSettings({ palette: option.id });
                  }}
                  style={localStyles.paletteItem}
                >
                  <View
                    style={[
                      localStyles.swatch,
                      {
                        backgroundColor: option.colors.background,
                        borderColor: active
                          ? option.colors.accent
                          : colors.line,
                      },
                    ]}
                  >
                    <View
                      style={[
                        localStyles.swatchCore,
                        { backgroundColor: option.colors.accent },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      localStyles.paletteLabel,
                      active ? localStyles.paletteLabelActive : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={localStyles.section}>
        <SectionTitle>SHAPE &amp; SIZE</SectionTitle>
        <View style={localStyles.card}>
          <Text style={localStyles.fieldLabel}>CORNERS</Text>
          <ChoiceRow
            onSelect={shape => updateSettings({ shape })}
            options={SHAPES}
            value={settings.shape}
          />
          <Text style={localStyles.fieldLabel}>LAYOUT SIZE</Text>
          <ChoiceRow
            onSelect={size => updateSettings({ size })}
            options={SIZES}
            value={settings.size}
          />
        </View>
      </View>

      <View style={localStyles.section}>
        <SectionTitle>TYPE</SectionTitle>
        <View style={localStyles.card}>
          <Text style={localStyles.fieldLabel}>FONT STYLE</Text>
          <ChoiceRow
            onSelect={font => updateSettings({ font })}
            options={FONTS}
            value={settings.font}
          />
          <Text style={localStyles.fieldLabel}>TEXT SIZE</Text>
          <ChoiceRow
            onSelect={textSize => updateSettings({ textSize })}
            options={TEXT_SIZES}
            value={settings.textSize}
          />
        </View>
      </View>

      <View style={localStyles.section}>
        <SectionTitle>HAPTICS</SectionTitle>
        <View style={localStyles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open the haptic lab"
            onPress={onOpenHaptics}
            style={({ pressed }) => [
              localStyles.navRow,
              pressed ? localStyles.choicePressed : null,
            ]}
          >
            <View style={localStyles.switchCopy}>
              <Text style={localStyles.switchLabel}>Haptic lab</Text>
              <Text style={localStyles.switchDescription}>
                Preview feels and build custom rhythms without pairing.
              </Text>
            </View>
            <Text style={localStyles.navArrow}>→</Text>
          </Pressable>
        </View>
      </View>

      <View style={localStyles.section}>
        <SectionTitle>FLASHLIGHT</SectionTitle>
        <View style={localStyles.card}>
          {flash.loading ? (
            <Text style={localStyles.switchDescription}>
              Checking the flashlight…
            </Text>
          ) : !flash.available ? (
            <Text style={localStyles.switchDescription}>
              This phone has no flashlight to sync or switch.
            </Text>
          ) : (
            <>
              <SettingSwitch
                description="Flashes this phone's torch in time with each incoming pulse. Turn it off to keep pulses dark."
                label="Flash with pulses"
                onValueChange={next => {
                  flash.toggle(next).catch(() => {});
                }}
                value={flash.flashEnabled}
              />
              {!flash.permission ? (
                <View style={localStyles.statusBlock}>
                  <Text style={localStyles.switchDescription}>
                    Camera access is off. VibeLink uses the camera only to
                    switch the torch — synced flashes and remote flashlight
                    requests need it.
                  </Text>
                  <SecondaryButton
                    label="Allow flashlight access"
                    onPress={() => {
                      flash.requestAccess().catch(() => {});
                    }}
                  />
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>

      <View style={localStyles.section}>
        <SectionTitle>PRIVACY</SectionTitle>
        {privacy.available ? (
          <View style={localStyles.card}>
            <SettingSwitch
              description="Turns the icon into a plain “System services” gear. Tapping it opens your phone's Settings instead of VibeLink."
              label="Privacy mode"
              onValueChange={next => {
                privacy.enablePrivacyMode(next);
              }}
              value={privacy.state.privacyMode}
            />
            <View style={localStyles.divider} />
            <SettingSwitch
              description="Incoming pulses are dropped silently. Toggle from Quick Settings when the app is closed."
              label="Pause delivery"
              onValueChange={next => {
                privacy.pauseDelivery(next);
              }}
              value={privacy.state.paused}
            />
            <View style={localStyles.divider} />
            <View style={localStyles.statusBlock}>
              <Text style={localStyles.switchDescription}>
                {privacy.state.privacyMode
                  ? 'VibeLink is disguised as “System services”. Tapping that icon opens the phone Settings app — open VibeLink with the tile or dial code below.'
                  : 'Off: the VibeLink icon opens VibeLink normally.'}
              </Text>
            </View>

            <View style={localStyles.recoveryCard}>
              <Text style={localStyles.recoveryLabel}>RECOVERY DIAL CODE</Text>
              <Text selectable style={localStyles.recoveryCode}>
                {RECOVERY_CODE}
              </Text>
              <Text style={localStyles.recoveryBody}>
                While disguised, open VibeLink with the “VibeLink app” tile in
                Quick Settings — it works from any screen and leaves the decoy
                untouched. On stock Android dialers you can also dial the code
                above. Samsung and other custom dialers may just place a call
                instead, so keep the tile as your main way in.
              </Text>
              <Text style={localStyles.recoveryBody}>
                The decoy is a separate launcher entry, so a home-screen icon
                pinned to the old VibeLink icon cannot be repointed by the app —
                remove it, then pin the gear. Turning Privacy mode off brings
                the real icon back.
              </Text>
              <Text style={localStyles.recoveryBody}>
                Android blocks background apps from reading volume buttons, so a
                volume combo cannot start or stop delivery while VibeLink is
                closed. Use the “VibeLink delivery” Quick Settings tile instead
                — it pauses or resumes delivery with one tap, no app opening
                needed.
              </Text>
            </View>
          </View>
        ) : (
          <View style={localStyles.card}>
            <Text style={localStyles.switchDescription}>
              Privacy controls need the Android build of VibeLink.
            </Text>
          </View>
        )}
      </View>

      <View style={localStyles.section}>
        <SectionTitle>APP</SectionTitle>
        <UpdateCard update={update} />
        <BundleCard bundle={bundle} />
      </View>

      <View style={localStyles.footer}>
        <SecondaryButton
          label="Reset appearance"
          onPress={() => {
            resetSettings();
          }}
        />
        <TextButton label="Back to VibeLink" onPress={onBack} />
      </View>
    </Screen>
  );
}

const makeStyles = ({ colors, radii, spacing, type }: AppTheme) =>
  StyleSheet.create({
    hero: {
      marginTop: 34,
      gap: 10,
    },
    eyebrow: {
      ...type.eyebrow,
      color: colors.accent,
    },
    title: {
      ...type.display,
      fontSize: 40,
      lineHeight: 43,
      color: colors.text,
    },
    body: {
      ...type.body,
      color: colors.textMuted,
      maxWidth: 420,
    },
    previewCard: {
      marginTop: spacing.large,
      borderRadius: radii.large,
      borderWidth: 1,
      borderColor: colors.accentLine,
      backgroundColor: colors.accentWash,
      padding: spacing.medium,
      gap: 5,
    },
    previewEyebrow: {
      ...type.eyebrow,
      fontSize: 9,
      letterSpacing: 1.6,
      color: colors.accent,
    },
    previewTitle: {
      ...type.title,
      fontSize: 26,
      lineHeight: 30,
      color: colors.text,
    },
    previewBody: {
      ...type.eyebrow,
      fontSize: 9,
      letterSpacing: 1.1,
      color: colors.textMuted,
    },
    section: {
      marginTop: spacing.large,
      gap: spacing.small,
    },
    sectionLabel: {
      ...type.eyebrow,
      color: colors.textFaint,
    },
    card: {
      borderRadius: radii.medium,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surface,
      padding: 14,
      gap: 12,
    },
    paletteRow: {
      flexDirection: 'row',
      gap: 10,
    },
    paletteItem: {
      flex: 1,
      alignItems: 'center',
      gap: 6,
    },
    swatch: {
      width: '100%',
      aspectRatio: 1.55,
      borderRadius: radii.small,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchCore: {
      width: 18,
      height: 18,
      borderRadius: 9,
    },
    paletteLabel: {
      ...type.eyebrow,
      fontSize: 8,
      letterSpacing: 1,
      color: colors.textFaint,
    },
    paletteLabelActive: {
      color: colors.accent,
    },
    fieldLabel: {
      ...type.eyebrow,
      fontSize: 9,
      letterSpacing: 1.4,
      color: colors.textFaint,
    },
    choiceRow: {
      flexDirection: 'row',
      gap: 7,
    },
    choice: {
      flex: 1,
      minHeight: 42,
      borderRadius: radii.small,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.surfaceRaised,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    choiceActive: {
      borderColor: colors.accentLine,
      backgroundColor: colors.accentWash,
    },
    choicePressed: {
      opacity: 0.7,
    },
    choiceLabel: {
      ...type.label,
      fontSize: 11,
      color: colors.textMuted,
    },
    choiceLabelActive: {
      color: colors.accent,
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    switchCopy: {
      flex: 1,
      gap: 3,
    },
    switchLabel: {
      ...type.label,
      color: colors.text,
    },
    switchDescription: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },
    divider: {
      height: 1,
      backgroundColor: colors.line,
    },
    statusBlock: {
      gap: 10,
    },
    recoveryCard: {
      borderRadius: radii.small,
      borderWidth: 1,
      borderColor: colors.lineStrong,
      backgroundColor: colors.surfaceRaised,
      padding: 12,
      gap: 6,
    },
    recoveryLabel: {
      ...type.eyebrow,
      fontSize: 8,
      letterSpacing: 1.4,
      color: colors.textFaint,
    },
    recoveryCode: {
      ...type.mono,
      fontSize: 18,
      letterSpacing: 1.5,
      color: colors.accent,
    },
    recoveryBody: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 16,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    navArrow: {
      color: colors.accent,
      fontSize: 18,
    },
    footer: {
      marginTop: spacing.large,
      gap: spacing.small,
      alignItems: 'stretch',
    },
  });
