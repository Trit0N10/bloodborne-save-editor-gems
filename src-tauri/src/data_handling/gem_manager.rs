//! Preset gems with genuine allocation in the game's item registry.
//! Mutations are atomic in memory; saving remains an explicit user action.
use std::{collections::{HashMap, HashSet}, ops::Range};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use super::{constants::*, enums::UpgradeType, file::FileData, save::SaveData,
    upgrades::{get_shape, UpgradeInfo}, gem_registry::{self, Registry, Record, word, put}};
const CONTAINER_CAPACITY: usize = 1984;
const NO_EFFECT: u32 = u32::MAX;
// Normal inventory has 1984 slots numbered 64..2047 in the native loader.
const MAX_SORT_INDEX: u32 = 2047;
const EMPTY_ITEM: [u8; 12] = [0,0,0,0,255,255,255,255,0,0,0,0];
// A normal game-created blood-gem source observed in the original character.
// Presets explicitly replace effects and shape, as the original editor does.
const NORMAL_GEM_SOURCE: u32 = 0x8001E460;
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GemPreset {
    pub id: String, pub name: String, pub english_name: String,
    pub category: String, pub rating: u8, pub shapes: Vec<String>,
    pub effects: [u32; 6], pub source: String, pub notes: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_id: Option<u32>,
    #[serde(default)] pub effect_labels: Vec<String>,
    #[serde(default)] pub level: u8,
}

#[cfg(test)]
mod synthetic_tests {
    use super::*;
    fn model() -> SaveData { SaveData::from_file(gem_registry::synthetic_file()).unwrap() }
    fn ids(save: &SaveData, storage: bool) -> HashSet<u32> {
        let inv = if storage { &save.storage } else { &save.inventory };
        inv.upgrades.get(&UpgradeType::Gem).into_iter().flatten().map(|gem| gem.id).collect()
    }
    #[test]
    fn publication_gem_manager_synthetic_batch_delete_readd_atomic_lifecycle() {
        let preset = catalog().unwrap().remove(0);
        for storage in [false, true] {
            let original = model(); let bytes = original.file.bytes.clone();
            let before = manager_data(&original, storage).unwrap().available_slots;
            assert_eq!(before, if storage {1984} else {1983});
            let added = add_preset(&original, &preset.id, &preset.shapes[0], storage, 12).unwrap();
            assert_eq!(original.file.bytes, bytes);
            assert_eq!(ids(&added, storage).len(), 12);
            assert_eq!(manager_data(&added, storage).unwrap().available_slots, before - 12);
            assert_eq!(added.stats, original.stats); assert!(same_position(&added, &original).unwrap());
            assert_eq!(added.bosses, original.bosses);
            assert_eq!(&added.file.bytes[0x13FFF0..], &[0xA5; 16]);
            let reopened = SaveData::from_file(added.file.clone()).unwrap();
            assert_eq!(serde_json::to_value(&reopened).unwrap(), serde_json::to_value(&added).unwrap());
            let id = *ids(&reopened, storage).iter().next().unwrap();
            assert!(delete_gem(&reopened, id, !storage).is_err());
            let deleted = delete_gem(&reopened, id, storage).unwrap();
            assert_eq!(ids(&deleted, storage).len(), 11);
            assert!(!ids(&deleted, storage).contains(&id));
            let readded = add_preset(&deleted, &preset.id, &preset.shapes[0], storage, 2).unwrap();
            assert_eq!(ids(&readded, storage).len(), 13);
            for (request, shape, quantity) in [("missing","Radial",1),(preset.id.as_str(),"Oath",1),(preset.id.as_str(),preset.shapes[0].as_str(),0),(preset.id.as_str(),preset.shapes[0].as_str(),u32::MAX)] {
                assert!(add_preset(&original, request, shape, storage, quantity).is_err());
                assert_eq!(original.file.bytes, bytes);
            }
        }
    }
    #[test]
    fn publication_gem_manager_synthetic_capacity_references_and_full_container() {
        let save = model(); let registry = gem_registry::parse(&save.file).unwrap();
        let container = validate_container(&save.file, true).unwrap();
        assert_eq!(capacity(&save.file, &registry, &container), 1984);
        let mut file = save.file.clone();
        put(&mut file.bytes, registry.stream_end - 8, 0xC0810007);
        assert!(!free_slots(&file.bytes, &registry).contains(&7));
        // An opaque reference at another generation protects its logical slot.
        let mut near_full = registry.clone();
        for (index, row) in near_full.slots.iter_mut().enumerate().skip(1) {
            let mut record = vec![0;40]; put(&mut record,0,0xC0800000 | index as u32);
            *row = Record { offset:0, bytes:record };
        }
        assert_eq!(capacity(&file, &near_full, &container), 0, "one empty ring sentinel must remain");
        let mut full = save.clone();
        for &at in &container.empty { for (offset,value) in [(0,0xB000044C),(4,0x4000044C),(8,1),(12,((at-container.start)/16+64) as u32)] { put(&mut full.file.bytes,at+offset,value); } }
        put(&mut full.file.bytes,container.count_offset,1984); put(&mut full.file.bytes,container.sort_offset,2047);
        assert_eq!(manager_data(&full,true).unwrap().available_slots,0);
        let preset = catalog().unwrap().remove(0); let before = full.file.bytes.clone();
        assert!(add_preset(&full,&preset.id,&preset.shapes[0],true,1).is_err());
        assert_eq!(full.file.bytes,before);
    }
    #[test]
    fn publication_gem_manager_synthetic_all_117_preset_shapes_and_effects_roundtrip() {
        let presets = catalog().unwrap(); assert_eq!(presets.len(),117);
        let file = gem_registry::synthetic_file(); let registry = gem_registry::parse(&file).unwrap();
        let mut combinations = 0;
        for preset in presets {
            assert_eq!(preset.effect_labels.len(),6);
            for shape in &preset.shapes {
                let mut bytes = vec![0;40]; put(&mut bytes,0,0xC0800007);
                put(&mut bytes,4,preset.source_id.unwrap_or(NORMAL_GEM_SOURCE));
                put(&mut bytes,8,1); put(&mut bytes,12,shape_id(shape).unwrap());
                for (i,effect) in preset.effects.iter().enumerate() {put(&mut bytes,16+i*4,*effect);}
                let mut slots = registry.slots.clone();slots[7]=Record{offset:0,bytes:bytes.clone()};
                let updated = gem_registry::serialize(&file,&registry,&slots,&file.bytes[registry.end..registry.stream_end]).unwrap();
                assert_eq!(gem_registry::parse(&updated).unwrap().slots[7].bytes,bytes,"{}/{}",preset.id,shape);
                combinations += 1;
            }
        }
        assert!(combinations>=117);
        eprintln!("Synthetic catalog covered 117 presets across {combinations} shape/effect combinations");
        assert_eq!([shape_id("Radial").unwrap(),shape_id("Triangle").unwrap(),shape_id("Waning").unwrap(),shape_id("Circle").unwrap(),shape_id("Droplet").unwrap()],[1,2,4,8,63]);
    }
}
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GemManagerData {
    pub presets: Vec<GemPreset>, pub available_slots: usize,
    pub can_add: bool, pub reason: String,
}
struct Container {
    start: usize, positions: Vec<usize>, empty: Vec<usize>, count_offset: usize,
    sort_offset: usize, count: u32, sort: u32,
}
fn shape_id(shape: &str) -> Result<u32, String> {
    match shape {
        "Radial" => Ok(1), "Triangle" => Ok(2), "Waning" => Ok(4),
        "Circle" => Ok(8), "Droplet" => Ok(63),
        _ => Err("不支持的血宝石形状。".into()),
    }
}

fn catalog() -> Result<Vec<GemPreset>, String> {
    let mut presets: Vec<GemPreset> = serde_json::from_str(include_str!("../../resources/gem-presets.json"))
        .map_err(|_| "血宝石预设库格式错误。")?;
    let effects: Value = serde_json::from_str(include_str!("../../resources/upgrades.json"))
        .map_err(|_| "血宝石效果资料无法读取。")?;
    let mut ids = HashSet::new();
    for preset in &mut presets {
        if preset.id.is_empty() || !ids.insert(preset.id.clone()) || preset.name.is_empty()
            || preset.english_name.is_empty() || preset.category.is_empty()
            || preset.source.is_empty() || preset.shapes.is_empty()
            || preset.effects[0] == NO_EFFECT {
            return Err("血宝石预设库包含不完整或重复的条目。".into());
        }
        let mut shapes = HashSet::new();
        for shape in &preset.shapes {
            shape_id(shape)?;
            if !shapes.insert(shape) { return Err("血宝石预设库包含重复形状。".into()); }
        }
        preset.effect_labels.clear();
        for (index, id) in preset.effects.iter().enumerate() {
            let info: UpgradeInfo = serde_json::from_value(effects["gemEffects"][id.to_string()].clone())
                .map_err(|_| "预设包含未收录的血宝石效果。")?;
            if index == 0 && info.rating != preset.rating {
                return Err("预设评级与游戏效果资料不一致。".into());
            }
            if index == 0 { preset.level = info.level; }
            preset.effect_labels.push(info.effect);
        }
        // The existing upstream renderer documents these exact unique-gem pairs.
        // A custom source ID is not a general-purpose raw-ID editing interface.
        if let Some(source) = preset.source_id {
            let valid = match (source, preset.effects[0]) {
                (2147633648, 3126204) => preset.effects[1] == 3045204
                    && preset.effects[2..].iter().all(|&id| id == NO_EFFECT),
                (2147633649, 3143408) | (2147633650, 3133407) =>
                    preset.effects[1..].iter().all(|&id| id == NO_EFFECT),
                _ => false,
            };
            if !valid { return Err("独特血宝石来源与效果组合不受支持。".into()); }
        }
    }
    if presets.is_empty() { return Err("血宝石预设库为空。".into()); }
    Ok(presets)
}

fn validate_container(file: &FileData, is_storage: bool) -> Result<Container, String> {
    let uname = file.offsets.username;
    // On disk: active count, then 1984 (handle, source, quantity, sort) records.
    // Upstream exposes the previous record's sort word as the next slot's number.
    // Upstream omits inventory slot zero (the fist in the supported saves).
    // Keep that existing slot untouched; storage exposes all 1984 positions.
    let (start, count_offset, sort_offset) = if is_storage {
        (file.offsets.storage.0 + 4, uname + USERNAME_TO_FIRST_STORAGE_COUNTER,
         uname + USERNAME_TO_SECOND_STORAGE_COUNTER)
    } else {
        (file.offsets.inventory.0.checked_sub(12).ok_or("背包边界不正确。")?,
         uname + USERNAME_TO_FIRST_INVENTORY_COUNTER,
         uname + USERNAME_TO_SECOND_INVENTORY_COUNTER)
    };
    let count = word(&file.bytes, count_offset)?;
    let sort = word(&file.bytes, sort_offset)?;
    if start != count_offset + 4 || count > CONTAINER_CAPACITY as u32 || sort > MAX_SORT_INDEX {
        return Err("背包数量或排序编号超出已验证范围，未进行修改。".into());
    }
    let end = start.checked_add(CONTAINER_CAPACITY * 16).ok_or("背包容量溢出。")?;
    if end > file.bytes.len() || end >= sort_offset {
        return Err("背包区域不完整，未进行修改。".into());
    }
    let mut positions = Vec::new();
    let mut empty = Vec::new();
    let mut occupied = 0;
    for index in 0..CONTAINER_CAPACITY {
        let at = start + index * 16;
        let is_empty = file.bytes[at..at + 12] == EMPTY_ITEM;
        if !is_empty {
            occupied += 1;
            if (index + 64) as u32 > sort {
                return Err("背包最大槽编号小于已有物品位置，请先在游戏中重新保存。".into());
            }
        }
        if is_storage || index > 0 {
            positions.push(at);
            if is_empty { empty.push(at); }
        } else if is_empty {
            return Err("原编辑器未显示的背包首槽为空，此布局尚未支持，未进行修改。".into());
        }
    }
    if occupied != count {
        return Err("背包实际物品数量与记录不一致，请先在游戏中重新保存。".into());
    }
    Ok(Container { start, positions, empty, count_offset, sort_offset, count, sort })
}


fn references(bytes: &[u8], registry: &Registry) -> HashMap<u32, Vec<usize>> {
    let mut refs: HashMap<u32, Vec<usize>> = registry.slots.iter()
        .filter(|row| row.upgrade()).map(|row| (row.id(), Vec::new())).collect();
    for (at, raw) in bytes[..registry.stream_end].windows(4).enumerate() {
        let id = u32::from_le_bytes(raw.try_into().unwrap());
        if let Some(found) = refs.get_mut(&id) { found.push(at); }
    }
    refs
}

fn free_slots(bytes: &[u8], registry: &Registry) -> Vec<usize> {
    // The game's loader remaps by low16 logical index, ignoring generation.
    // Also protect opaque references to an otherwise-empty index, including
    // those with a different type/generation. Unused physical tail is excluded.
    let mut referenced = HashSet::new();
    for raw in bytes[..registry.stream_end].windows(4) {
        let id = u32::from_le_bytes(raw.try_into().unwrap());
        if matches!(id >> 28, 8 | 9 | 12) && id & 0x00800000 != 0
            && id & 0x0F000000 == 0 && (id & 0xFFFF) < gem_registry::SLOT_COUNT as u32 {
            referenced.insert((id & 0xFFFF) as usize);
        }
    }
    registry.slots.iter().enumerate().filter(|(i, row)| row.empty() && !referenced.contains(i))
        .map(|(i, _)| i).collect()
}

fn capacity(file: &FileData, registry: &Registry, container: &Container) -> usize {
    let empty = registry.slots.iter().filter(|row| row.empty()).count();
    // Native registry allocation is a 4096-position ring retaining one empty
    // position: simultaneous occupied-record limit is 4095.
    free_slots(&file.bytes, registry).len().min(empty.saturating_sub(1))
        .min(container.empty.len()).min((file.bytes.len() - registry.stream_end) / 32)
}

pub fn manager_data(save: &SaveData, is_storage: bool) -> Result<GemManagerData, String> {
    let presets = catalog()?;
    let status = (|| {
        let registry = gem_registry::parse(&save.file)?;
        let container = validate_container(&save.file, is_storage)?;
        let slots = capacity(&save.file, &registry, &container);
        let reason = if slots > 0 {
            format!("可新增 {slots} 颗。每颗独立创建，不替换已有宝石；删除后可继续添加。")
        } else if container.empty.is_empty() {
            "所选背包已满；删除一颗未装备血宝石后可继续添加。".into()
        } else { "物品记录已达到存档实际容量，无法继续新增。".into() };
        Ok::<_, String>((slots, reason))
    })();
    let (available_slots, reason) = status.unwrap_or_else(|error| (0, error));
    Ok(GemManagerData { presets, available_slots, can_add: available_slots > 0, reason })
}

fn finish(old: &SaveData, registry: &Registry, slots: &[Record], body: &[u8], allowed: &[Range<usize>]) -> Result<SaveData, String> {
    let original = &old.file.bytes[registry.end..registry.stream_end];
    if body.len() != original.len() || original.iter().zip(body).enumerate()
        .any(|(i, (a,b))| a != b && !allowed.iter().any(|r| r.contains(&(registry.end + i)))) {
        return Err("角色数据修改范围校验失败，原存档保持不变。".into());
    }
    let file = gem_registry::serialize(&old.file, registry, slots, body)?;
    let rebuilt = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| SaveData::from_file(file)))
        .map_err(|_| "存档重建失败，原存档保持不变。")?
        .map_err(|_| "存档重建失败，原存档保持不变。")?;
    gem_registry::parse(&rebuilt.file)?;
    if rebuilt.stats != old.stats || !same_position(old, &rebuilt)? || rebuilt.bosses != old.bosses {
        return Err("角色数据保留校验失败，原存档保持不变。".into());
    }
    Ok(rebuilt)
}

fn same_position(a: &SaveData, b: &SaveData) -> Result<bool, String> {
    // Coordinates carry an absolute editor offset that correctly changes when
    // the preceding registry grows. Compare the saved location, not metadata.
    let values = [a,b].map(|save| {
        let mut value=serde_json::to_value(&save.position).map_err(|e|e.to_string())?;
        if let Some(coords)=value["coordinates"].as_object_mut(){coords.remove("offset");}
        Ok::<_,String>(value)
    });
    let [left,right]=values;Ok(left?==right?)
}

pub fn add_preset(save: &SaveData, preset_id: &str, shape: &str, is_storage: bool, quantity: u32) -> Result<SaveData, String> {
    let preset = catalog()?.into_iter().find(|p| p.id == preset_id).ok_or("未找到所选血宝石预设。")?;
    if !preset.shapes.iter().any(|s| s == shape) { return Err("该预设没有所选形状的已验证变体。".into()); }
    let shape = shape_id(shape)?;
    let registry = gem_registry::parse(&save.file)?;
    let container = validate_container(&save.file, is_storage)?;
    let available = capacity(&save.file, &registry, &container);
    if quantity == 0 || quantity as usize > available {
        return Err(format!("数量须为 1 到 {available} 之间的整数；未添加任何宝石。"));
    }
    let mut slots = registry.slots.clone();
    let mut body = save.file.bytes[registry.end..registry.stream_end].to_vec();
    let source = preset.source_id.unwrap_or(NORMAL_GEM_SOURCE);
    let free = free_slots(&save.file.bytes, &registry);
    let mut allowed = vec![container.count_offset..container.count_offset+4, container.sort_offset..container.sort_offset+4];
    let mut ids = Vec::new();
    let mut max_slot_index = container.sort;
    for n in 0..quantity as usize {
        let logical = free[n];
        // Native ctor's canonical generation. Load reconstructs runtime handles
        // and remaps old low16 indices, so no persisted global cursor is changed.
        let id = 0xC0800000 | logical as u32;
        let mut bytes = vec![0; 40];
        for (at, value) in [(0,id),(4,source),(8,1),(12,shape)] { put(&mut bytes, at, value); }
        for (i,effect) in preset.effects.iter().enumerate() { put(&mut bytes,16+i*4,*effect); }
        slots[logical] = Record { offset: 0, bytes };
        let at = container.empty[n];
        // Native item sorting key for source category 8 is zero. Its packed
        // DWORD therefore contains only the logical inventory slot (low12).
        let slot_index = ((at - container.start) / 16 + 64) as u32;
        max_slot_index = max_slot_index.max(slot_index);
        for (offset, value) in [(0,id),(4,source),(8,1),(12,slot_index)] {
            put(&mut body,at-registry.end+offset,value);
        }
        allowed.push(at..at+16);
        ids.push(id);
    }
    put(&mut body,container.count_offset-registry.end,container.count+quantity);
    put(&mut body,container.sort_offset-registry.end,max_slot_index);
    let updated = finish(save,&registry,&slots,&body,&allowed)?;
    let inventory = if is_storage { &updated.storage } else { &updated.inventory };
    for id in ids {
        let gem = inventory.upgrades.get(&UpgradeType::Gem).and_then(|g|g.iter().find(|g|g.id==id))
            .ok_or("新宝石未能正确回读，原存档保持不变。")?;
        if gem.source != source || gem.shape != get_shape(shape as u8,UpgradeType::Gem).unwrap()
            || gem.effects.iter().map(|(id,_)|*id).collect::<Vec<_>>() != preset.effects {
            return Err("新宝石的效果回读校验失败，原存档保持不变。".into());
        }
    }
    validate_container(&updated.file,is_storage)?;
    Ok(updated)
}

pub fn delete_gem(save: &SaveData, gem_id: u32, is_storage: bool) -> Result<SaveData, String> {
    let registry = gem_registry::parse(&save.file)?;
    let logical = (gem_id & 0xFFFF) as usize;
    let record = registry.slots.get(logical).filter(|r|r.id()==gem_id && r.upgrade())
        .ok_or("未找到所选血宝石。")?;
    if word(&record.bytes,8)? != 1 || !matches!(word(&record.bytes,12)?,1|2|4|8|63) {
        return Err("只能删除已识别的血宝石，不能删除符文。".into());
    }
    let container = validate_container(&save.file,is_storage)?;
    let matches:Vec<_> = container.positions.iter().copied().filter(|&p|word(&save.file.bytes,p).ok()==Some(gem_id)).collect();
    if matches.len()!=1 { return Err("所选位置中没有唯一的未装备血宝石。".into()); }
    let at=matches[0];
    let slot_index=((at-container.start)/16+64) as u32;
    if word(&save.file.bytes,at+4)?!=word(&record.bytes,4)? || word(&save.file.bytes,at+8)?!=1 {
        return Err("所选宝石的背包引用不一致。".into());
    }
    if word(&save.file.bytes,at+12)? & 0xFFF != slot_index {
        return Err("所选宝石的背包槽编号异常，请先在游戏中重新保存。".into());
    }
    let refs=references(&save.file.bytes,&registry);
    if refs.get(&gem_id).map(|v|v.as_slice()) != Some(&[record.offset,at][..]) {
        return Err("该血宝石还被装备或其他数据引用，不能删除。".into());
    }
    // Refuse alternate-generation/type references to the same logical slot:
    // native load remaps references by logical index, not the complete handle.
    for (offset,raw) in save.file.bytes[..registry.stream_end].windows(4).enumerate() {
        let id=u32::from_le_bytes(raw.try_into().unwrap());
        if matches!(id>>28,8|9|12) && id&0x00800000!=0 && id&0x0F000000==0
            && (id&0xFFFF) as usize==logical && offset!=record.offset && offset!=at {
            return Err("该宝石逻辑槽还有其他引用，不能删除。".into());
        }
    }
    let mut slots=registry.slots.clone();
    slots[logical]=Record{offset:0,bytes:vec![0,0,0,0,255,255,255,255]};
    let mut body=save.file.bytes[registry.end..registry.stream_end].to_vec();
    body[at-registry.end..at-registry.end+12].copy_from_slice(&EMPTY_ITEM);
    put(&mut body,at-registry.end+12,0);
    put(&mut body,container.count_offset-registry.end,container.count.checked_sub(1).ok_or("背包计数异常。")?);
    // Native deletion decrements the maximum-slot marker only when removing
    // that exact highest slot; it does not compact other occupied entries.
    let max_slot=if container.sort==slot_index { container.sort-1 } else { container.sort };
    put(&mut body,container.sort_offset-registry.end,max_slot);
    let updated=finish(save,&registry,&slots,&body,&[at..at+16,container.count_offset..container.count_offset+4,container.sort_offset..container.sort_offset+4])?;
    let inventory=if is_storage{&updated.storage}else{&updated.inventory};
    if inventory.upgrades.get(&UpgradeType::Gem).is_some_and(|g|g.iter().any(|g|g.id==gem_id)) {
        return Err("宝石删除回读校验失败。".into());
    }
    validate_container(&updated.file,is_storage)?;
    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::super::offsets::Offsets;
    use std::path::{Path, PathBuf};
    fn from_bytes(bytes: Vec<u8>) -> SaveData {
        let offsets=Offsets::build(&bytes).unwrap();
        SaveData::from_file(FileData{bytes,offsets,resources_path:PathBuf::from("resources")}).unwrap()
    }
    fn fixture(n:u8)->SaveData {from_bytes(std::fs::read(format!("saves/testsave{n}")).unwrap())}
    fn add(save:&SaveData,n:u32,storage:bool)->SaveData {
        let p=catalog().unwrap().remove(0);
        add_preset(save,&p.id,&p.shapes[0],storage,n).unwrap()
    }
    fn owned(save:&SaveData,storage:bool)->HashSet<u32> {
        let inv=if storage{&save.storage}else{&save.inventory};
        inv.upgrades.get(&UpgradeType::Gem).into_iter().flatten().map(|g|g.id).collect()
    }
    fn preserved(old:&SaveData,new:&SaveData,removed:Option<u32>) {
        let before=gem_registry::parse(&old.file).unwrap();
        let after=gem_registry::parse(&new.file).unwrap();
        for (i,row) in before.slots.iter().enumerate().filter(|(_,r)|!r.empty()&&Some(r.id())!=removed) {
            assert_eq!(row.bytes,after.slots[i].bytes,"original record {i} changed");
        }
        assert_eq!(old.stats,new.stats);assert!(same_position(old,new).unwrap());assert_eq!(old.bosses,new.bosses);
        // Upstream Article.number is derived from the preceding slot's sort
        // byte; editing an empty predecessor changes that editor-only index.
        // Its saved article bytes are independently protected by finish/oracle.
        fn semantic(mut value:Value)->Value {
            match &mut value {
                Value::Object(map)=>{map.remove("number");map.remove("offset");for v in map.values_mut(){*v=semantic(v.take());}},
                Value::Array(a)=>{for v in a{*v=semantic(v.take());}}, _=>{}
            } value
        }
        assert_eq!(semantic(serde_json::to_value(&old.inventory.articles).unwrap()),semantic(serde_json::to_value(&new.inventory.articles).unwrap()));
        assert_eq!(semantic(serde_json::to_value(&old.storage.articles).unwrap()),semantic(serde_json::to_value(&new.storage.articles).unwrap()));
    }
    #[test]
    #[ignore = "Requires upstream save fixtures or explicit disposable-save opt-in; not shipped"]
    fn gem_manager_batch_twelve_new_records_save_reopen_delete_readd() {
        for storage in [false,true] {
            let original=fixture(6);let raw=original.file.bytes.clone();
            let old=gem_registry::parse(&original.file).unwrap();
            let before=owned(&original,storage);
            let added=add(&original,12,storage);
            assert_eq!(original.file.bytes,raw);
            let new=gem_registry::parse(&added.file).unwrap();
            assert_eq!(new.end,old.end+12*32);
            let created:Vec<_>=owned(&added,storage).difference(&before).copied().collect();
            assert_eq!(created.len(),12);preserved(&original,&added,None);
            let reopened=from_bytes(added.file.bytes.clone());
            assert_eq!(serde_json::to_value(&added).unwrap(),serde_json::to_value(&reopened).unwrap());
            let deleted=delete_gem(&reopened,created[3],storage).unwrap();
            assert!(!owned(&deleted,storage).contains(&created[3]));
            for id in created.iter().filter(|&&id|id!=created[3]){assert!(owned(&deleted,storage).contains(id));}
            preserved(&reopened,&deleted,Some(created[3]));
            assert_eq!(gem_registry::parse(&deleted.file).unwrap().end,new.end-32);
            let readded=add(&from_bytes(deleted.file.bytes.clone()),2,storage);
            preserved(&deleted,&readded,None);
            assert_eq!(owned(&readded,storage).len(),before.len()+13);
        }
    }
    #[test]
    #[ignore = "Requires upstream save fixtures or explicit disposable-save opt-in; not shipped"]
    fn gem_manager_zero_orphan_records_still_adds_more_than_five() {
        let original=fixture(6);let registry=gem_registry::parse(&original.file).unwrap();
        let refs=references(&original.file.bytes,&registry);
        let mut slots=registry.slots.clone();
        for row in &mut slots {
            if row.upgrade() && word(&row.bytes,8).unwrap()==1
                && refs[&row.id()]==vec![row.offset] {
                *row=Record{offset:0,bytes:vec![0,0,0,0,255,255,255,255]};
            }
        }
        let file=gem_registry::serialize(&original.file,&registry,&slots,&original.file.bytes[registry.end..registry.stream_end]).unwrap();
        let cleared=SaveData::from_file(file).unwrap();
        let r=gem_registry::parse(&cleared.file).unwrap();let refs=references(&cleared.file.bytes,&r);
        assert!(!r.slots.iter().any(|x|x.upgrade()&&word(&x.bytes,8).unwrap()==1&&refs[&x.id()]==vec![x.offset]));
        let added=add(&cleared,10,false);preserved(&cleared,&added,None);
        assert_eq!(gem_registry::parse(&added.file).unwrap().end,r.end+320);
    }
    #[test]
    #[ignore = "Requires upstream save fixtures or explicit disposable-save opt-in; not shipped"]
    fn gem_manager_invalid_request_and_full_inventory_are_atomic() {
        let save=fixture(6);let raw=save.file.bytes.clone();let p=catalog().unwrap().remove(0);
        for (id,shape,n) in [(p.id.as_str(),p.shapes[0].as_str(),0),("bad",p.shapes[0].as_str(),1),
            (p.id.as_str(),"Oath",1),(p.id.as_str(),p.shapes[0].as_str(),u32::MAX)] {
            assert!(add_preset(&save,id,shape,false,n).is_err());assert_eq!(save.file.bytes,raw);
        }
        let mut full=save.clone();let container=validate_container(&full.file,true).unwrap();
        for &at in &container.empty {
            for (off,v) in [(0,0xB000044C),(4,0x4000044C),(8,1)]{put(&mut full.file.bytes,at+off,v);}
        }
        put(&mut full.file.bytes,container.count_offset,CONTAINER_CAPACITY as u32);
        put(&mut full.file.bytes,container.sort_offset,2047);
        assert!(validate_container(&full.file,true).is_ok());
        assert_eq!(manager_data(&full,true).unwrap().available_slots,0);
        let bytes=full.file.bytes.clone();assert!(add_preset(&full,&p.id,&p.shapes[0],true,1).is_err());
        assert_eq!(full.file.bytes,bytes);
    }
    #[test]
    #[ignore = "Requires upstream save fixtures or explicit disposable-save opt-in; not shipped"]
    fn gem_manager_rune_equipped_and_wrong_location_delete_rejected() {
        let original=fixture(9);let bytes=original.file.bytes.clone();
        let r=gem_registry::parse(&original.file).unwrap();
        let rune=r.slots.iter().find(|x|x.upgrade()&&word(&x.bytes,8).unwrap()==2).unwrap().id();
        assert!(delete_gem(&original,rune,false).is_err());
        assert!(delete_gem(&original,0xC0800074,false).is_err());
        let id=*owned(&original,false).iter().next().unwrap();
        assert!(delete_gem(&original,id,true).is_err());assert_eq!(original.file.bytes,bytes);
    }
    #[test]
    #[ignore = "Requires upstream save fixtures or explicit disposable-save opt-in; not shipped"]
    fn gem_manager_alternate_generation_opaque_reference_is_protected() {
        let original=fixture(6);let registry=gem_registry::parse(&original.file).unwrap();
        let first=free_slots(&original.file.bytes,&registry)[0];
        let mut marked=original.clone();
        put(&mut marked.file.bytes,registry.stream_end-8,0xC0810000|first as u32);
        assert!(!free_slots(&marked.file.bytes,&registry).contains(&first));
        let added=add(&marked,1,false);preserved(&marked,&added,None);
        let id=*owned(&added,false).difference(&owned(&original,false)).next().unwrap();
        assert_ne!(id&0xFFFF,first as u32);
        let mut extra=added.clone();let end=gem_registry::parse(&extra.file).unwrap().stream_end;
        put(&mut extra.file.bytes,end-12,id^0x00010000);
        let bytes=extra.file.bytes.clone();assert!(delete_gem(&extra,id,false).is_err());assert_eq!(extra.file.bytes,bytes);
    }
    #[test]
    #[ignore = "Requires upstream save fixtures or explicit disposable-save opt-in; not shipped"]
    fn gem_manager_catalog_every_preset_shape_roundtrips_fixture() {
        // Bundled upstream fixture only: never open a user's active save.
        let original = fixture(6);
        let original_ids = owned(&original, false);
        for preset in catalog().unwrap() {
            for shape in &preset.shapes {
                let added = add_preset(&original, &preset.id, shape, false, 1)
                    .unwrap_or_else(|e| panic!("{}/{}: {e}", preset.id, shape));
                let reopened = from_bytes(added.file.bytes.clone());
                let ids = owned(&reopened, false);
                let created: Vec<_> = ids.difference(&original_ids).copied().collect();
                assert_eq!(created.len(), 1, "{}/{}", preset.id, shape);
                let registry = gem_registry::parse(&reopened.file).unwrap();
                let row = &registry.slots[(created[0] & 0xFFFF) as usize];
                assert_eq!(word(&row.bytes, 12).unwrap(), shape_id(shape).unwrap());
                for (index, expected) in preset.effects.iter().enumerate() {
                    assert_eq!(word(&row.bytes, 16 + index * 4).unwrap(), *expected,
                        "{}/{} effect {}", preset.id, shape, index);
                }
                preserved(&original, &reopened, None);
            }
        }
    }
    #[test]
    #[ignore = "Requires upstream save fixtures or explicit disposable-save opt-in; not shipped"]
    fn gem_manager_catalog_unique_sources_and_malformed_header() {
        let original=fixture(6);
        for p in catalog().unwrap().into_iter().filter(|p|p.source_id.is_some()) {
            let added=add_preset(&original,&p.id,&p.shapes[0],false,1).unwrap();
            let id=*owned(&added,false).difference(&owned(&original,false)).next().unwrap();
            let r=gem_registry::parse(&added.file).unwrap();
            assert_eq!(word(&r.slots[(id&0xFFFF)as usize].bytes,4).unwrap(),p.source_id.unwrap());
            preserved(&original,&added,None);
        }
        let p=catalog().unwrap().remove(0);
        for at in [0x0C,0x18,0x44,0x4C,0x50] {
            let mut broken=original.clone();let v=word(&broken.file.bytes,at).unwrap();put(&mut broken.file.bytes,at,v+4);
            let bytes=broken.file.bytes.clone();assert!(add_preset(&broken,&p.id,&p.shapes[0],false,1).is_err());
            assert_eq!(broken.file.bytes,bytes);
        }
    }
    #[test]
    #[ignore = "Requires upstream save fixtures or explicit disposable-save opt-in; not shipped"]
    fn gem_manager_holes_use_physical_slot_and_registry_retains_ring_sentinel() {
        let mut original=fixture(6);let layout=validate_container(&original.file,true).unwrap();
        // A previously reached last index must not prohibit reuse of lower holes.
        put(&mut original.file.bytes,layout.sort_offset,2047);
        let added=add(&original,2,true);
        let r=gem_registry::parse(&added.file).unwrap();let c=validate_container(&added.file,true).unwrap();
        assert_eq!(c.sort,2047);
        let delta=r.end-gem_registry::parse(&original.file).unwrap().end;
        for &at in layout.empty.iter().take(2) {
            assert_eq!(word(&added.file.bytes,at+delta+12).unwrap(),((at-layout.start)/16+64) as u32);
        }
        let id=word(&added.file.bytes,layout.empty[0]+delta).unwrap();
        let removed=delete_gem(&added,id,true).unwrap();
        assert_eq!(validate_container(&removed.file,true).unwrap().sort,2047);
        let again=add(&removed,1,true);assert_eq!(validate_container(&again.file,true).unwrap().sort,2047);
        let mut nearly_full=gem_registry::parse(&original.file).unwrap();
        let mut empty_left=1;
        for (index,row) in nearly_full.slots.iter_mut().enumerate() {
            if row.empty() {
                if empty_left>0{empty_left-=1;continue;}
                let mut bytes=vec![0;40];put(&mut bytes,0,0xC0800000|index as u32);
                *row=Record{offset:0,bytes};
            }
        }
        assert_eq!(capacity(&original.file,&nearly_full,&layout),0,"Native ring's last empty position is not usable");
        let original=fixture(6);let added=add(&original,3,true);
        let c=validate_container(&added.file,true).unwrap();
        let delta=gem_registry::parse(&added.file).unwrap().end-gem_registry::parse(&original.file).unwrap().end;
        let last_added=validate_container(&original.file,true).unwrap().empty[2]+delta;
        let logical=((last_added-c.start)/16+64) as u32;
        // Choose fixture's newly appended last slot, which is the current max.
        assert_eq!(c.sort,logical);
        let id=word(&added.file.bytes,last_added).unwrap();
        let deleted=delete_gem(&added,id,true).unwrap();
        assert_eq!(validate_container(&deleted.file,true).unwrap().sort,c.sort-1);
        let readded=add(&deleted,1,true);assert_eq!(validate_container(&readded.file,true).unwrap().sort,c.sort);
        let mut bad=original.clone();let id=word(&bad.file.bytes,84).unwrap();
        put(&mut bad.file.bytes,84,id & !0x00800000);
        assert!(gem_registry::parse(&bad.file).is_err());
    }
    #[test]
    #[ignore = "Requires upstream save fixtures or explicit disposable-save opt-in; not shipped"]
    fn gem_manager_optional_disposable_user_copy_exports_for_independent_verification() {
        let path=std::env::var_os("BB_GEM_TEST_SAVE").expect("Set BB_GEM_TEST_SAVE to a disposable lawful fixture to run this ignored test");
        let path=PathBuf::from(path);let original_bytes=std::fs::read(&path).unwrap();
        // Explicit fixture opt-in only. Never write to the supplied input.
        let original=from_bytes(original_bytes.clone());let added=add(&original,12,false);preserved(&original,&added,None);
        let capacity=manager_data(&original,false).unwrap().available_slots;
        let reopened=from_bytes(added.file.bytes.clone());
        let new_id=*owned(&reopened,false).difference(&owned(&original,false)).next().unwrap();
        let deleted=delete_gem(&reopened,new_id,false).unwrap();preserved(&reopened,&deleted,Some(new_id));
        if let Some(output)=std::env::var_os("BB_GEM_TEST_OUTPUT") {
            let dir=Path::new(&output);std::fs::create_dir_all(dir).unwrap();
            std::fs::write(dir.join("after-add-12"),&added.file.bytes).unwrap();
            std::fs::write(dir.join("after-delete-one"),&deleted.file.bytes).unwrap();
            let filled=add(&original,capacity as u32,false);preserved(&original,&filled,None);
            assert_eq!(manager_data(&filled,false).unwrap().available_slots,0);
            let p=catalog().unwrap().remove(0);
            assert!(add_preset(&filled,&p.id,&p.shapes[0],false,1).is_err());
            assert_eq!(validate_container(&filled.file,false).unwrap().count,CONTAINER_CAPACITY as u32);
            std::fs::write(dir.join("after-fill-capacity"),&filled.file.bytes).unwrap();
        }
        assert_eq!(std::fs::read(&path).unwrap(),original_bytes);
        eprintln!("Actual allocation user-copy: original capacity={capacity}; added12; deleted1; originals preserved");
    }
}
