use chrono::{DateTime, SecondsFormat, Utc};
use serde::{Deserialize, Deserializer, Serializer};

/// Serde (de)serializer for DateTime<Utc> that only keeps whole-second RFC3339.
pub mod serde_rfc3339_secs {
    use super::*;
    pub fn serialize<S>(dt: &DateTime<Utc>, s: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let trimmed = dt.to_rfc3339_opts(SecondsFormat::Secs, true);
        s.serialize_str(&trimmed)
    }

    pub fn deserialize<'de, D>(d: D) -> Result<DateTime<Utc>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let s = String::deserialize(d)?;
        s.parse::<DateTime<Utc>>().map_err(serde::de::Error::custom)
    }
}

/// Serde (de)serializer for Option<DateTime<Utc>> with whole-second RFC3339.
pub mod serde_opt_rfc3339_secs {
    use super::*;
    pub fn serialize<S>(value: &Option<DateTime<Utc>>, s: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match value {
            Some(dt) => {
                let trimmed = dt.to_rfc3339_opts(SecondsFormat::Secs, true);
                s.serialize_some(&trimmed)
            }
            None => s.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(d: D) -> Result<Option<DateTime<Utc>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let opt = Option::<String>::deserialize(d)?;
        match opt {
            Some(s) => {
                let dt = s
                    .parse::<DateTime<Utc>>()
                    .map_err(serde::de::Error::custom)?;
                Ok(Some(dt))
            }
            None => Ok(None),
        }
    }
}
