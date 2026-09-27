import from jac.schemas.nodes { Asset }
import from jac.schemas.edges { HasPrice, HasReserve, HasLiability, StampedBy, DependsOn }

walker:pub HealthCheck {
    can run with Asset entry {
        prices = [here ->:HasPrice:->];
        reserves = [here ->:HasReserve:->];
        liabs = [here ->:HasLiability:->];
        stamps = [here ->:StampedBy:->];

        children = [];
        if len(reserves) > 0 {
            children = [reserves[0] ->:DependsOn:->];
        }

        green_stamps = 0;
        yellow_stamps = 0;
        red_stamps = 0;

        for s in stamps {
            if str(s.color) == "green" {
                green_stamps += 1;
            } elif str(s.color) == "yellow" {
                yellow_stamps += 1;
            } elif str(s.color) == "red" {
                red_stamps += 1;
            }
        }

        report {
            "status": "ok",
            "asset_id": str(here.id),
            "counts": {
                "prices": len(prices),
                "reserves": len(reserves),
                "liabilities": len(liabs),
                "children": len(children),
                "stamps": len(stamps)
            },
            "stamp_colors": {
                "green": green_stamps,
                "yellow": yellow_stamps,
                "red": red_stamps
            }
        };
    }
}
