import java.util.ArrayList;

public class Armario {
    private ArrayList<Prenda> prendas;

    public Armario() {
        prendas = new ArrayList<>();
    }

    public void agregarPrenda(Prenda prenda) {
        prendas.add(prenda);
    }

    public void eliminarPrenda(Prenda prenda) {
        prendas.remove(prenda);
    }

    public ArrayList<Prenda> getPrendas() {
        return prendas;
    }
}
