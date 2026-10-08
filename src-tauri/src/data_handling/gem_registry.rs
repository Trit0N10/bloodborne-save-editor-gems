//! Version-65 item registry and save-stream relocation.
//! See gem-allocation-evidence.md for the independently checked serializer.
//! Empty logical slots occupy 8 bytes, upgrades 40, equipment 60. Upgrades
//! serialize first; the other slots follow in logical-slot order.

use std::collections::HashSet;
use super::{file::FileData, offsets::Offsets};

pub const SLOT_COUNT: usize = 4096;
pub const START: usize = 0x54;
pub const RELOCATED_HEADER_WORDS: [usize; 9] = [0x10, 0x18, 0x1C, 0x24, 0x2C, 0x34, 0x3C, 0x44, 0x4C];

pub fn word(bytes: &[u8], at: usize) -> Result<u32, String> {
    let raw = bytes.get(at..at.checked_add(4).ok_or("存档偏移溢出。")?)
        .ok_or("存档结构不完整，未进行修改。")?;
    Ok(u32::from_le_bytes(raw.try_into().unwrap()))
}

pub fn put(bytes: &mut [u8], at: usize, value: u32) {
    bytes[at..at + 4].copy_from_slice(&value.to_le_bytes());
}

#[derive(Clone, Debug)]
pub struct Record {
    pub offset: usize,
    pub bytes: Vec<u8>,
}

impl Record {
    pub fn id(&self) -> u32 { u32::from_le_bytes(self.bytes[..4].try_into().unwrap()) }
    pub fn empty(&self) -> bool { self.id() == 0 }
    pub fn upgrade(&self) -> bool { self.id() >> 28 == 12 }
}

#[derive(Clone, Debug)]
pub struct Registry {
    /// Indexed by the logical slot encoded in the low 16 handle bits.
    pub slots: Vec<Record>,
    pub end: usize,
    pub stream_end: usize,
}

pub fn stream_end(bytes: &[u8]) -> Result<usize, String> {
    if bytes.len() != 0x140000 || word(bytes, 0)? != 65
        || word(bytes, 0xC)? != START as u32 || word(bytes, 0x14)? != START as u32
        || word(bytes, 0x28)? != 0x96 || word(bytes, 0x30)? != 8
        || word(bytes, 0x38)? != 0x249F1 || word(bytes, 0x50)? != 0x20004 {
        return Err("该存档版本或长度尚未验证，未进行修改。".into());
    }
    let h = |at| word(bytes, at).map(|n| n as usize);
    if h(0xC)? + h(0x10)? != h(0x34)?
        || h(0x14)? + h(0x18)? != h(0x24)?
        || h(0x24)? + h(0x28)? != h(0x2C)?
        || h(0x2C)? + h(0x30)? != h(0x1C)?
        || h(0x1C)? + 0x53 != h(0x34)? || h(0x20)? != 0
        || h(0x34)? + h(0x38)? != h(0x3C)?
        || h(0x3C)? + h(0x40)? != h(0x44)?
        || h(0x44)? + 0x50 != h(0x4C)?
        || h(0x3C)? + h(0x48)? != h(0x4C)? {
        return Err("存档分区边界校验失败，未进行修改。".into());
    }
    let menu = h(0x4C)? + h(0x50)?;
    // Actual v65 serializer: menu's u16/u16/u32 header, its payload, then
    // seven trailing fields of 1+4+1+4+4+1+12 bytes. Not the physical EOF.
    if word(bytes, menu)? != 1 || word(bytes, menu + 4)? != 0x1000 {
        return Err("菜单存档区不属于已验证布局，未进行修改。".into());
    }
    let end = menu + 8 + h_at(bytes, menu + 4)? + 27;
    if end > bytes.len() || h(0x24)? <= START || h(0x4C)? >= menu {
        return Err("存档有效数据超出文件容量，未进行修改。".into());
    }
    Ok(end)
}

fn h_at(bytes: &[u8], at: usize) -> Result<usize, String> { word(bytes, at).map(|n| n as usize) }

pub fn parse(file: &FileData) -> Result<Registry, String> {
    let bytes = &file.bytes;
    let stream_end = stream_end(bytes)?;
    let expected_end = file.offsets.username.checked_sub(151).ok_or("角色数据边界异常。")?;
    let mut slots: Vec<Option<Record>> = vec![None; SLOT_COUNT];
    let mut tail = Vec::new();
    let mut at = START;
    let mut prefix = true;
    let mut previous_upgrade = None;
    let mut ids = HashSet::new();
    for _ in 0..SLOT_COUNT {
        let id = word(bytes, at)?;
        let source = word(bytes, at + 4)?;
        let size = match id >> 28 {
            12 if prefix && source >> 28 == 8 => 40,
            8 | 9 => { prefix = false; 60 },
            0 if id == 0 && source == u32::MAX => { prefix = false; 8 },
            _ => return Err("物品记录不属于已验证布局，未进行修改。".into()),
        };
        let end = at.checked_add(size).ok_or("物品记录偏移溢出。")?;
        if end > expected_end || end > stream_end { return Err("物品记录越界。".into()); }
        let record = Record { offset: at, bytes: bytes[at..end].to_vec() };
        if id != 0 && (!ids.insert(id) || (id & 0xFFFF) as usize >= SLOT_COUNT
            || id & 0x0F800000 != 0x00800000) {
            return Err("物品编号重复或超出游戏容量，未进行修改。".into());
        }
        if record.upgrade() {
            let index = (id & 0xFFFF) as usize;
            if previous_upgrade.is_some_and(|last| last >= index) {
                return Err("宝石记录顺序异常，未进行修改。".into());
            }
            previous_upgrade = Some(index);
            slots[index] = Some(record);
        } else { tail.push(record); }
        at = end;
    }
    if at != expected_end || at >= word(bytes, 0x24)? as usize {
        return Err("4096 条物品记录与角色区域不一致，未进行修改。".into());
    }
    let mut tail = tail.into_iter();
    for (index, slot) in slots.iter_mut().enumerate() {
        if slot.is_none() {
            let record = tail.next().ok_or("缺少物品记录。")?;
            if !record.empty() && (record.id() & 0xFFFF) as usize != index {
                return Err("装备的逻辑槽编号不一致，未进行修改。".into());
            }
            *slot = Some(record);
        }
    }
    if tail.next().is_some() { return Err("出现额外物品记录。".into()); }
    Ok(Registry { slots: slots.into_iter().map(Option::unwrap).collect(), end: at, stream_end })
}

/// Rebuild only the logical stream. Bytes beyond max(old_end,new_end) remain
/// at their original absolute offsets, including nonzero unused buffer data.
pub fn serialize(file: &FileData, old: &Registry, slots: &[Record], body: &[u8]) -> Result<FileData, String> {
    if slots.len() != SLOT_COUNT || old.end > old.stream_end
        || body.len() != old.stream_end - old.end
        || slots.iter().any(|r| r.bytes.len() < 8) {
        return Err("存档重建参数不一致。".into());
    }
    let mut registry_bytes = Vec::new();
    for upgrades in [true, false] {
        for (index, record) in slots.iter().enumerate().filter(|(_, row)| row.upgrade() == upgrades) {
            if !record.empty() && (record.id() & 0xFFFF) as usize != index {
                return Err("新物品编号与逻辑槽不一致。".into());
            }
            let size = if record.upgrade() { 40 } else if record.empty() { 8 } else { 60 };
            if record.bytes.len() != size { return Err("新物品记录长度异常。".into()); }
            registry_bytes.extend_from_slice(&record.bytes);
        }
    }
    let new_registry_end = START + registry_bytes.len();
    let new_end = new_registry_end.checked_add(body.len()).ok_or("存档容量溢出。")?;
    if new_end > file.bytes.len() { return Err("存档实际空间已满。".into()); }
    let delta = new_registry_end as i64 - old.end as i64;
    let mut updated = file.clone();
    updated.bytes[START..new_registry_end].copy_from_slice(&registry_bytes);
    updated.bytes[new_registry_end..new_end].copy_from_slice(body);
    for at in RELOCATED_HEADER_WORDS {
        let value = word(&file.bytes, at)? as i64 + delta;
        let value = u32::try_from(value).map_err(|_| "存档分区偏移溢出。")?;
        put(&mut updated.bytes, at, value);
    }
    updated.offsets = std::panic::catch_unwind(|| Offsets::build(&updated.bytes))
        .map_err(|_| "存档偏移重建失败。")?.map_err(|_| "存档偏移重建失败。")?;
    let reparsed = parse(&updated)?;
    if reparsed.end != new_registry_end || reparsed.stream_end != new_end
        || reparsed.slots.iter().zip(slots).any(|(a, b)| a.bytes != b.bytes) {
        return Err("新物品记录回读校验失败，原存档保持不变。".into());
    }
    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    #[ignore = "Requires ten upstream save fixtures, deliberately excluded from publication"]
    fn gem_registry_roundtrip_all_ten_fixtures_preserves_every_byte() {
        for n in 0..10 {
            let bytes = std::fs::read(format!("saves/testsave{n}")).unwrap();
            let file = FileData { offsets: Offsets::build(&bytes).unwrap(), bytes, resources_path: PathBuf::new() };
            let parsed = parse(&file).unwrap();
            let updated = serialize(&file, &parsed, &parsed.slots, &file.bytes[parsed.end..parsed.stream_end]).unwrap();
            assert_eq!(updated, file, "fixture {n}");
        }
    }
}

/// An authored, minimal structural model for tests. It exists only in test
/// builds, is made from zero bytes and constants, and never reads a save file.
#[cfg(test)]
pub(super) fn synthetic_file() -> FileData {
    use super::constants::*;
    let mut bytes = vec![0; 0x140000];
    let registry_end = START + SLOT_COUNT * 8;
    for at in (START..registry_end).step_by(8) { put(&mut bytes, at + 4, u32::MAX); }
    let username = registry_end + 151;
    let character_end = registry_end + 100_000;
    let q2c = character_end + 0x96;
    let q1c = q2c + 8;
    let q34 = q1c + 0x53;
    let q3c = q34 + 0x249F1;
    let q44 = q3c + 0x400;
    let q4c = q44 + 0x50;
    for (at, value) in [(0,65),(0xC,START),(0x10,q34-START),(0x14,START),
        (0x18,character_end-START),(0x1C,q1c),(0x20,0),(0x24,character_end),
        (0x28,0x96),(0x2C,q2c),(0x30,8),(0x34,q34),(0x38,0x249F1),
        (0x3C,q3c),(0x40,0x400),(0x44,q44),(0x48,q4c-q3c),(0x4C,q4c),(0x50,0x20004)] {
        put(&mut bytes, at, value as u32);
    }
    put(&mut bytes, q4c + 0x20004, 1);
    put(&mut bytes, q4c + 0x20004 + 4, 0x1000);
    let face = username + USERNAME_TO_INV_OFFSET + 34028;
    bytes[face..face+4].copy_from_slice(b"FACE");
    let lced = username + USERNAME_TO_AOB + 128;
    bytes[lced..lced+4].copy_from_slice(b"LCED");
    put(&mut bytes, lced + 16, u32::MAX); // coordinate signature followed by zeros
    for (count, start, sort) in [
        (username + USERNAME_TO_FIRST_INVENTORY_COUNTER, username + USERNAME_TO_FIRST_INVENTORY_COUNTER + 4, username + USERNAME_TO_SECOND_INVENTORY_COUNTER),
        (username + USERNAME_TO_FIRST_STORAGE_COUNTER, username + USERNAME_TO_FIRST_STORAGE_COUNTER + 4, username + USERNAME_TO_SECOND_STORAGE_COUNTER)] {
        for index in 0..1984 { put(&mut bytes, start + index * 16 + 4, u32::MAX); }
        put(&mut bytes, count, 0); put(&mut bytes, sort, 0);
    }
    // Preserve the parser's deliberately omitted first inventory slot.
    let first = username + USERNAME_TO_FIRST_INVENTORY_COUNTER + 4;
    for (offset, value) in [(0,0xB000044C),(4,0x4000044C),(8,1),(12,64)] { put(&mut bytes, first + offset, value); }
    put(&mut bytes, username + USERNAME_TO_FIRST_INVENTORY_COUNTER, 1);
    put(&mut bytes, username + USERNAME_TO_SECOND_INVENTORY_COUNTER, 64);
    // Canary in unused physical capacity must survive stream relocation.
    bytes[0x13FFF0..].fill(0xA5);
    let offsets = Offsets::build(&bytes).unwrap();
    assert_eq!(offsets.username, username);
    FileData { bytes, offsets, resources_path: std::path::PathBuf::from("resources") }
}

#[cfg(test)]
mod synthetic_tests {
    use super::*;
    #[test]
    fn publication_gem_registry_synthetic_roundtrip_allocate_and_remove() {
        let file = synthetic_file();
        let old = parse(&file).unwrap();
        assert_eq!(old.slots.len(), SLOT_COUNT);
        assert!(old.slots.iter().all(Record::empty));
        let unchanged = serialize(&file, &old, &old.slots, &file.bytes[old.end..old.stream_end]).unwrap();
        assert_eq!(unchanged, file);
        let mut slots = old.slots.clone();
        let mut upgrade = vec![0; 40];
        put(&mut upgrade, 0, 0xC0800007); put(&mut upgrade, 4, 0x8001E460);
        put(&mut upgrade, 8, 1); put(&mut upgrade, 12, 2);
        slots[7] = Record { offset: 0, bytes: upgrade.clone() };
        let added = serialize(&file, &old, &slots, &file.bytes[old.end..old.stream_end]).unwrap();
        let parsed = parse(&added).unwrap();
        assert_eq!(parsed.end, old.end + 32);
        assert_eq!(parsed.slots[7].bytes, upgrade);
        for at in RELOCATED_HEADER_WORDS { assert_eq!(word(&added.bytes, at).unwrap(), word(&file.bytes, at).unwrap() + 32); }
        assert_eq!(&added.bytes[0x13FFF0..], &[0xA5;16]);
        slots[7] = old.slots[7].clone();
        let removed = serialize(&added, &parsed, &slots, &added.bytes[parsed.end..parsed.stream_end]).unwrap();
        assert_eq!(parse(&removed).unwrap().end, old.end);
        assert_eq!(&removed.bytes[..old.stream_end], &file.bytes[..old.stream_end]);
    }
    #[test]
    fn publication_gem_registry_synthetic_corruption_rejected_without_mutation() {
        let original = synthetic_file();
        for (at, value) in [(0,64),(0xC,START as u32+1),(0x24,1),(0x50,0)] {
            let mut broken = original.clone(); put(&mut broken.bytes, at, value);
            let before = broken.bytes.clone(); assert!(parse(&broken).is_err()); assert_eq!(broken.bytes, before);
        }
        let registry = parse(&original).unwrap();
        assert!(serialize(&original, &registry, &registry.slots[..10], &[]).is_err());
        assert!(word(&[0;3], 0).is_err()); assert!(word(&[0;4], usize::MAX).is_err());
        let mut wrong = registry.slots.clone();
        wrong[1] = Record { offset:0, bytes:vec![1,0,128,192,0,0,0,128] };
        assert!(serialize(&original, &registry, &wrong, &original.bytes[registry.end..registry.stream_end]).is_err());
    }
}
