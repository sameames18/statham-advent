"""Pull infobox facts for each Statham vehicle from Wikipedia wikitext.
Output is a raw research dump; the curated catalog lives in server/data/films.json."""
import json, re, sys, urllib.parse, urllib.request

PAGES = [
 "The_Transporter","Transporter_2","Chaos_(2005_action_film)","Revolver_(2005_film)","Crank_(film)",
 "War_(2007_film)","The_Bank_Job","In_the_Name_of_the_King","Death_Race_(2008_film)","Transporter_3",
 "Crank:_High_Voltage","The_Mechanic_(2011_film)","Blitz_(2011_film)","Killer_Elite_(film)","Safe_(2012_film)",
 "Parker_(2013_film)","Hummingbird_(film)","Homefront_(2013_film)","Wild_Card_(2015_film)","Mechanic:_Resurrection",
 "The_Meg","Wrath_of_Man","Operation_Fortune:_Ruse_de_Guerre","Meg_2:_The_Trench","The_Beekeeper_(2024_film)",
 "A_Working_Man","Shelter_(2026_film)","Mutiny_(2026_film)",
]

def raw(title):
    url = "https://en.wikipedia.org/w/index.php?action=raw&redirect=yes&title=" + urllib.parse.quote(title)
    req = urllib.request.Request(url, headers={"User-Agent": "statham-advent-research/0.1"})
    return urllib.request.urlopen(req).read().decode("utf-8")

def field(text, name):
    m = re.search(r"^\|\s*" + name + r"\s*=\s*(.+)$", text, re.M)
    if not m: return None
    v = re.sub(r"<ref[^>]*/>|<ref.*?</ref>|<ref.*$", "", m.group(1))
    v = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", v)
    return v.strip()

out = []
for p in PAGES:
    t = raw(p)
    if t.lstrip().upper().startswith("#REDIRECT"):
        t = raw(re.search(r"\[\[([^\]]+)\]\]", t).group(1))
    plot = re.search(r"==\s*Plot\s*==\n(.+?)\n==", t, re.S)
    out.append({
        "page": p,
        "director": field(t, "director"),
        "released": field(t, "released"),
        "runtime": field(t, "runtime"),
        "gross": field(t, "gross"),
        "plot": re.sub(r"<ref.*?</ref>|\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", lambda m: m.group(1) or "", plot.group(1))[:900] if plot else None,
    })
    print(p, "ok", file=sys.stderr)
json.dump(out, open("films_raw.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
