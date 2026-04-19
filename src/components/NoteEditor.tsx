import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TAG_TEMPLATES, detectPreferredSelectionOffset } from '../utils/noteDocument';

type ToolbarType = keyof typeof TAG_TEMPLATES;

type Props = {
	value: string;
	selection: { start: number; end: number };
	onChangeText: (value: string) => void;
	onSelectionChange?: (selection: { start: number; end: number }) => void;
	onDismiss: () => void;
	onSave: () => void;
	onInsertTemplate: (template: string, cursorOffset: number) => void;
};

const TOOLBAR_ITEMS: { key: ToolbarType; label: string; icon?: keyof typeof Ionicons.glyphMap }[] = [
	{ key: 'chapter', label: '大' },
	{ key: 'section', label: '中' },
	{ key: 'subsection', label: '小' },
	{ key: 'text', label: '本文', icon: 'text-outline' },
	{ key: 'word', label: '単語', icon: 'list-outline' },
	{ key: 'image', label: '画像', icon: 'image-outline' },
];

const NoteEditor: React.FC<Props> = ({ value, selection, onChangeText, onSelectionChange, onDismiss, onSave, onInsertTemplate }) => {
	const [localSelection, setLocalSelection] = useState({ start: 0, end: 0 });

	useEffect(() => {
		const end = value.length;
		setLocalSelection((prev) => {
			const nextStart = Math.min(prev.start, end);
			const nextEnd = Math.min(prev.end, end);
			if (nextStart === prev.start && nextEnd === prev.end) return prev;
			return { start: nextStart, end: nextEnd };
		});
	}, [value]);

	useEffect(() => {
		setLocalSelection(selection);
	}, [selection]);

	const helperText = useMemo(
		() => '通常の文章はそのまま入力できます。見出しや単語は下のボタンでタグを挿入すると、上のノート表示に即時反映されます。',
		[]
	);

	return (
		<KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
			<View style={styles.card}>
				<View style={styles.headerRow}>
					<View style={{ flex: 1 }}>
						<Text style={styles.title}>ページ編集</Text>
						<Text style={styles.caption}>{helperText}</Text>
					</View>
					<TouchableOpacity onPress={onDismiss} style={styles.iconButton}>
						<Ionicons name="close" size={18} color="#4E4034" />
					</TouchableOpacity>
				</View>

				<TextInput
					style={styles.input}
					multiline
					autoFocus
					value={value}
					onChangeText={onChangeText}
					selection={localSelection}
					onSelectionChange={(event) => {
						const next = event.nativeEvent.selection;
						setLocalSelection(next);
						onSelectionChange?.(next);
					}}
					placeholder={'本文\n\n<chapter>大見出し</chapter>\n<word>apple<meaning>りんご</meaning></word>'}
					placeholderTextColor="#9B8B7A"
					textAlignVertical="top"
				/>

				<View style={styles.toolbarWrap}>
					{TOOLBAR_ITEMS.map((item) => {
						const template = TAG_TEMPLATES[item.key];
						return (
							<TouchableOpacity
								key={item.key}
								onPress={() => onInsertTemplate(template, detectPreferredSelectionOffset(template))}
								style={styles.toolbarButton}
							>
								{item.icon ? <Ionicons name={item.icon} size={15} color="#FFF9F2" style={{ marginRight: 4 }} /> : null}
								<Text style={styles.toolbarButtonText}>{item.label}</Text>
							</TouchableOpacity>
						);
					})}
				</View>

				<TouchableOpacity onPress={onSave} style={styles.saveButton}>
					<Ionicons name="checkmark" size={18} color="#FFF9F2" />
					<Text style={styles.saveButtonText}>保存</Text>
				</TouchableOpacity>
			</View>
		</KeyboardAvoidingView>
	);
};

const styles = StyleSheet.create({
	container: {
		position: 'absolute',
		left: 12,
		right: 12,
		bottom: 14,
		zIndex: 60,
	},
	card: {
		borderRadius: 20,
		backgroundColor: 'rgba(255, 250, 244, 0.98)',
		borderWidth: 1,
		borderColor: '#D9C7B4',
		padding: 14,
		shadowColor: '#000',
		shadowOpacity: 0.12,
		shadowRadius: 14,
		shadowOffset: { width: 0, height: 6 },
		elevation: 8,
	},
	headerRow: {
		flexDirection: 'row',
		alignItems: 'flex-start',
		marginBottom: 10,
		columnGap: 10,
	},
	title: {
		fontSize: 16,
		fontWeight: '700',
		color: '#3F3227',
		marginBottom: 4,
	},
	caption: {
		fontSize: 12,
		lineHeight: 18,
		color: '#6D5C4B',
	},
	iconButton: {
		width: 32,
		height: 32,
		borderRadius: 16,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#F0E4D7',
	},
	input: {
		minHeight: 180,
		maxHeight: 280,
		borderRadius: 16,
		borderWidth: 1,
		borderColor: '#D9C7B4',
		backgroundColor: '#FFFDF9',
		paddingHorizontal: 14,
		paddingVertical: 12,
		fontSize: 15,
		lineHeight: 24,
		color: '#2F251D',
		marginBottom: 12,
	},
	toolbarWrap: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
		marginBottom: 12,
	},
	toolbarButton: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 999,
		backgroundColor: '#7A5D46',
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
	toolbarButtonText: {
		color: '#FFF9F2',
		fontWeight: '700',
		fontSize: 12,
	},
	saveButton: {
		alignSelf: 'flex-end',
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 999,
		backgroundColor: '#3F7A56',
		paddingHorizontal: 14,
		paddingVertical: 10,
		gap: 4,
	},
	saveButtonText: {
		color: '#FFF9F2',
		fontWeight: '700',
		fontSize: 13,
	},
});

export default NoteEditor;
