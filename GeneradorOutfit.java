import java.util.ArrayList;
import java.util.Random;

public class GeneradorOutfit {

    public Outfit generarOutfit(Armario armario, String ocasion) {

        ArrayList<Prenda> prendas = armario.getPrendas();

        if (prendas.isEmpty()) {
            return null;
        }

        Outfit outfit = new Outfit("Outfit generado", ocasion);

        Random random = new Random();

        Prenda prenda = prendas.get(random.nextInt(prendas.size()));

        outfit.agregarPrenda(prenda);

        return outfit;
    }
}